import React, { Component, FormEvent } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, Scatter, Tooltip, XAxis, YAxis } from 'recharts';

import './App.css';

type AppState = {
  tempNsUrl: string;
  tempToken: string;
  nightscoutUrl: string;
  token: string;
};

export class App extends Component<{}, AppState> {
  constructor(props: AppState) {
    super(props);
    this.updateNightscoutData = this.updateNightscoutData.bind(this);
    this.updateTempNsUrl = this.updateTempNsUrl.bind(this);
    this.updateTempToken = this.updateTempToken.bind(this);
    this.state = { nightscoutUrl: "", tempNsUrl: "", token: "", tempToken: "" };
  }

  updateNightscoutData(e: FormEvent) {
    e.preventDefault(); //prevent reload
    this.setState({
      nightscoutUrl: this.state.tempNsUrl,
      token: this.state.tempToken,
    });
  }

  updateTempNsUrl(e: FormEvent) {
    this.setState({ tempNsUrl: (e.target as HTMLTextAreaElement).value });
  }

  updateTempToken(e: FormEvent) {
    this.setState({ tempToken: (e.target as HTMLTextAreaElement).value });
  }

  render() {
    var plotWrapper;
    if (this.state.nightscoutUrl && this.state.token) {
      plotWrapper = (
        <PlotWrapper
          nightscoutUrl={this.state.nightscoutUrl}
          token={this.state.token}
        />
      );
    } else {
      plotWrapper = undefined;
    }
    return (
      <div>
        <h3>CGM calibration</h3>
        <form onSubmit={this.updateNightscoutData}>
          <label htmlFor="nightscout-input">Enter your Nightscout URL</label>
          <input
            id="nightscout-input"
            onChange={this.updateTempNsUrl}
            value={this.state.tempNsUrl}
          />
          <label htmlFor="token-input">Enter your token</label>
          <input
            id="token-input"
            onChange={this.updateTempToken}
            value={this.state.tempToken}
          />
          <button>Submit</button>
        </form>
        <p>
          The URL is {this.state.nightscoutUrl}, and the token is{" "}
          {this.state.token}
        </p>
        {plotWrapper}
      </div>
    );
  }
}

export default App;

type PlotWrapperProps = {
  nightscoutUrl: string;
  token: string;
};

type PlotWrapperState = {
  lastGlucoseValues: GlucoseValue[];
  sensorStarts: SensorStart[];
  calibrations: Calibration[];
  calibrationValues: GlucoseValue[];
};

type GlucoseValue = {
  dateString: string;
  sgv: number;
  type: string;
};

type Calibration = {
  slope: number;
  intercept: number;
  unfiltered_avg: number;
  glucose: number;
  date: Date;
};

type SensorStart = {
  created_at: string;
  eventType: string;
};

class PlotWrapper extends Component<PlotWrapperProps, PlotWrapperState> {
  constructor(props: PlotWrapperProps) {
    super(props);
    this.state = {
      lastGlucoseValues: [],
      sensorStarts: [],
      calibrations: [],
      calibrationValues: [],
    };
  }

  render() {
    var chart;
    if (this.state.calibrations.length > 0) {
      chart = <CalibrationChart calibrations={this.state.calibrations} />;
    } else {
      chart = undefined;
    }
    return (
      <div>
        <p>The last 3 values are:</p>
        <ul>
          {this.state.lastGlucoseValues.map((gv) => (
            <li key={gv.dateString}>
              {gv.dateString} {gv.sgv}
            </li>
          ))}
        </ul>
        {chart}
      </div>
    );
  }

  async componentDidMount() {
    this.fetchLastThree();
    await this.fetchSensorStarts();
    await this.fetchCalibrations();
  }

  async fetchLastThree() {
    await fetch(
      this.props.nightscoutUrl +
        "/api/v3/entries?&sort$desc=date&limit=3&fields=dateString,sgv,direction`&now=" +
        Date.now() +
        "&token=" +
        this.props.token
    )
      .then((response) => response.json())
      .then((response) => {
        var gvs = [];
        for (var g of response) {
          gvs.push(g as GlucoseValue);
        }
        this.setState({ lastGlucoseValues: gvs });
      });
  }

  async fetchSensorStarts() {
    await fetch(
      this.props.nightscoutUrl +
        "/api/v3/treatments?&sort$desc=date&limit=10&fields=eventType,created_at&eventType$in=Sensor Start&now=" +
        Date.now() +
        "&token=" +
        this.props.token
    )
      .then((response) => response.json())
      .then((response) => {
        var ss = [];
        for (var s of response) {
          ss.push(s as SensorStart);
        }
        this.setState({ sensorStarts: ss });
      });
  }

  async fetchCalibrationSlopes() {
    await fetch(
      this.props.nightscoutUrl +
        "/api/v3/entries?&sort$desc=date&fields=dateString,sgv,type,slope,intercept&type$in=cal&now=" +
        Date.now() +
        "&token=" +
        this.props.token
    )
      .then((response) => response.json())
      .then((response) => {
        var cvs = [];
        for (var c of response) {
          cvs.push(c as Calibration);
        }
        this.setState({ calibrations: cvs });
      });
  }

  async fetchCalibrations() {
    let response = await fetch(
      this.props.nightscoutUrl +
        "/api/v3/treatments?&sort$desc=date&fields=glucose,created_at&glucoseType$in=Finger&notes$in=Sensor Calibration&now=" +
        Date.now() +
        "&token=" +
        this.props.token
    );
    let calibration_values = await response.json();
    let last_sensor_start_date = new Date(
      this.state.sensorStarts[0].created_at
    );

    let calibrations: Calibration[] = [];

    for (let cv of calibration_values) {
      if (new Date(cv.created_at) > last_sensor_start_date) {
        let response = await fetch(
          this.props.nightscoutUrl +
            "/api/v3/entries?&sort$desc=date&limit=1&fields=dateString,sgv,unfiltered&dateString$lt=" +
            cv.created_at +
            "&now=" +
            Date.now() +
            "&token=" +
            this.props.token
        );
        let previous = await response.json();

        response = await fetch(
          this.props.nightscoutUrl +
            "/api/v3/entries?&sort=date&limit=1&fields=dateString,sgv,unfiltered&dateString$gt=" +
            cv.created_at +
            "&now=" +
            Date.now() +
            "&token=" +
            this.props.token
        );
        let next = await response.json();
        let unfiltered_avg = (previous[0].unfiltered + next[0].unfiltered) / 2;

        response = await fetch(
          this.props.nightscoutUrl +
            "/api/v3/entries?&sort$desc=date&fields=dateString,sgv,type,slope,intercept&type$in=cal&dateString$in=" +
            cv.created_at +
            "&now=" +
            Date.now() +
            "&token=" +
            this.props.token
        );
        let calibration_slope_details = (await response.json())[0];

        let calibration = {
          unfiltered_avg: unfiltered_avg,
          glucose: cv.glucose,
          date: cv.created_at,
          slope: calibration_slope_details.slope,
          intercept: calibration_slope_details.intercept,
        } as Calibration;
        calibrations.push(calibration);
      }
    }
    this.setState({ calibrations: calibrations });
  }
}

type CalibrationChartProps = {
  calibrations: Calibration[];
};

class CalibrationChart extends Component<
  CalibrationChartProps,
  { linePoints: Calibration[] }
> {
  constructor(props: CalibrationChartProps) {
    super(props);
    this.state = { linePoints: [] };
  }

  componentDidMount() {
    let lastCalibration = this.props.calibrations[0];
    let raw0 = lastCalibration.intercept;
    let raw250 = 250 * lastCalibration.slope + lastCalibration.intercept;
    let point0 = {
      glucose: 0,
      unfiltered_avg: raw0,
      slope: lastCalibration.slope,
      intercept: lastCalibration.intercept,
    } as Calibration;
    let point250 = { glucose: 250, unfiltered_avg: raw250 } as Calibration;
    this.setState({ linePoints: [point0, point250] });
  }

  render() {
    return (
      <ComposedChart
        width={670}
        height={600}
        data={this.props.calibrations}
        margin={{
          top: 0,
          right: 50,
          bottom: 0,
          left: 20,
        }}
      >
        <CartesianGrid strokeDasharray="5 5" />
        <Tooltip />
        <Legend
          layout="vertical"
          verticalAlign="top"
          align="right"
          wrapperStyle={{ left: 100, right: 0, top: 0, bottom: 0 }}
        />

        <XAxis
          type="number"
          domain={[0, 250]}
          ticks={[50, 100, 150, 200, 250]}
          dataKey="glucose"
          name="glucose"
          unit="mg/dl"
        />
        <YAxis
          type="number"
          domain={[0, 300000]}
          ticks={[0, 60000, 120000, 180000, 240000, 300000]}
          dataKey="unfiltered_avg"
          name="raw"
          unit=""
        />
        <Scatter
          name="red"
          dataKey="unfiltered_avg"
          fill="red"
          legendType="none"
        />
        <Line
          data={this.state.linePoints}
          dataKey="unfiltered_avg"
          stroke="blue"
          dot={false}
          activeDot={false}
          legendType="rect"
          name={
            this.state.linePoints.length > 0
              ? Math.round(this.state.linePoints[0].slope) +
                "x + " +
                Math.round(this.state.linePoints[0].intercept)
              : ""
          }
        />
      </ComposedChart>
    );
  }
}

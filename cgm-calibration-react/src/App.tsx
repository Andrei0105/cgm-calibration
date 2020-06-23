import React, { Component, FormEvent } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, Scatter, XAxis, YAxis } from 'recharts';
import regression, { DataPoint } from 'regression';

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
        <div className="div-form">
          <div className="div-title">CGM calibration statistics</div>
          <form onSubmit={this.updateNightscoutData}>
            <Input
              id={"1"}
              changeValue={this.updateTempNsUrl.bind(this)}
              label="Nightscout URL"
              predicted="https://"
              locked={false}
              active={false}
              value={this.state.tempNsUrl}
            />
            <br></br>
            <Input
              id={"2"}
              changeValue={this.updateTempToken.bind(this)}
              label="Token"
              predicted=""
              locked={false}
              active={false}
              value={this.state.tempToken}
            />
            <br></br>
            <button>Submit</button>
            <div className="div-form-text">The token is NOT your Nightscout API Secret.</div>
            <div className="div-form-text">Create a token with the readable role by following <a href="http://www.nightscout.info/wiki/welcome/website-features/0-9-features/authentication-roles">this guide.</a></div>
            <div className="div-form-text">The source code is available <a href="https://github.com/Andrei0105/cgm-calibration">here</a>. For feature requests open an issue.</div>
            <br></br>
          </form>
        </div>
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
    var charts;
    if (this.state.calibrations.length > 0) {
      charts = (
        <div>
          {this.state.calibrations.map((_, index) => (
            <CalibrationChart
              key={index}
              calibrations={this.state.calibrations.slice(
                index,
                this.state.calibrations.length
              )}
            />
          ))}
        </div>
      );
    } else {
      charts = <span>Loading...</span>;
    }
    return <div className="div-charts">{charts}</div>;
  }

  async componentDidMount() {
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
    let nextCalibrationDate = new Date();
    nextCalibrationDate.setDate(nextCalibrationDate.getDate() + 10);
    for (let cv of calibration_values) {
      if (
        !(
          nextCalibrationDate.getTime() >
          new Date(cv.created_at).getTime() + 30 * 60 * 1000
        )
      ) {
        nextCalibrationDate = new Date(cv.created_at);
        continue;
      }
      nextCalibrationDate = new Date(cv.created_at);
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
  { linePoints: Calibration[]; lineFitPoints: Calibration[] }
> {
  constructor(props: CalibrationChartProps) {
    super(props);
    this.state = { linePoints: [], lineFitPoints: [] };
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

    let calibration_points = [];
    for (let c of this.props.calibrations) {
      calibration_points.push([c.glucose, c.unfiltered_avg] as DataPoint);
    }
    if (this.props.calibrations.length >= 2) {
      let result = regression.linear(calibration_points);
      const slope = result.equation[0];
      const intercept = result.equation[1];
      raw0 = intercept;
      raw250 = 250 * slope + intercept;
      point0 = {
        glucose: 0,
        unfiltered_avg: raw0,
        slope: slope,
        intercept: intercept,
      } as Calibration;
      point250 = { glucose: 250, unfiltered_avg: raw250 } as Calibration;
      this.setState({ lineFitPoints: [point0, point250] });
    }
  }

  render() {
    return (
      <div className="div-chart">
        <ComposedChart
          width={670}
          height={600}
          data={this.props.calibrations}
          margin={{
            top: 10,
            right: 50,
            bottom: 0,
            left: 10,
          }}
        >
          <CartesianGrid strokeDasharray="5 5" fillOpacity="1" />
          {/* <Tooltip /> */}
          <Legend
            layout="vertical"
            verticalAlign="top"
            align="right"
            wrapperStyle={{ left: 90, right: 0, top: 15, bottom: 0 }}
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
                ? "Spike " +
                  Math.round(this.state.linePoints[0].slope) +
                  "x + " +
                  Math.round(this.state.linePoints[0].intercept)
                : ""
            }
          />
          {this.state.lineFitPoints.length > 0 ? (
            <Line
              data={this.state.lineFitPoints}
              dataKey="unfiltered_avg"
              stroke="purple"
              dot={false}
              activeDot={false}
              legendType="rect"
              name={
                this.state.lineFitPoints.length > 0
                  ? "Regr. " +
                    Math.round(this.state.lineFitPoints[0].slope) +
                    "x + " +
                    Math.round(this.state.lineFitPoints[0].intercept)
                  : ""
              }
            />
          ) : (
            ""
          )}
        </ComposedChart>
      </div>
    );
  }
}

type InputProps = {
  predicted: string;
  locked: boolean;
  active: boolean;
  value?: string;
  error?: string;
  label: string;
  id: string;
  changeValue: (event: React.FormEvent<Element>) => void;
};

type InputState = {
  active: boolean;
  value: string;
  error: string;
  label: string;
};

class Input extends Component<InputProps, InputState> {
  constructor(props: InputProps) {
    super(props);

    this.state = {
      active: (props.locked && props.active) || false,
      value: props.value || "",
      error: props.error || "",
      label: props.label || "Label",
    };
  }

  changeValue(event: React.FormEvent<Element>) {
    const value = (event.target as HTMLTextAreaElement).value;
    this.setState({ value, error: "" });
  }

  handleKeyPress(event: React.KeyboardEvent<HTMLElement>) {
    if (event.which === 13) {
      this.setState({ value: this.props.predicted });
    }
  }

  render() {
    const { active, value, error, label } = this.state;
    const { predicted, locked } = this.props;
    const fieldClassName = `field ${
      (locked ? active : active || value) && "active"
    } ${locked && !active && "locked"}`;

    return (
      <div className={fieldClassName}>
        {active && value && predicted && predicted.includes(value) && (
          <p className="predicted">{predicted}</p>
        )}
        <input
          id={this.props.id}
          type="text"
          value={this.props.value}
          placeholder={label}
          onChange={this.props.changeValue}
          onKeyPress={this.handleKeyPress.bind(this)}
          onFocus={() => !locked && this.setState({ active: true })}
          onBlur={() => !locked && this.setState({ active: false })}
        />
        <label htmlFor={this.props.id} className={error && "error"}>
          {error || label}
        </label>
      </div>
    );
  }
}

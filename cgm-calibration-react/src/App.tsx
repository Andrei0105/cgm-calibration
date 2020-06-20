import React, { Component, FormEvent } from 'react';

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
  calibrationSlopes: Calibration[];
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
      calibrationSlopes: [],
      calibrationValues: [],
    };
  }

  render() {
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
        this.setState({ calibrationSlopes: cvs });
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
    
    let calibrations: Calibration[] = []

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
            "/api/v3/entries?&sort$desc=date&fields=dateString,sgv,type,slope,intercept&type$in=cal&dateString$in=" + cv.created_at + "&now=" +
            Date.now() +
            "&token=" +
            this.props.token
        )
        let calibration_slope_details = (await response.json())[0]
        
        let calibration = {
          unfiltered_avg: unfiltered_avg,
          glucose: cv.glucose,
          date: cv.created_at,
          slope: calibration_slope_details.slope,
          intercept: calibration_slope_details.intercept,
        } as Calibration;
        calibrations.push(calibration)
      }
    }
    this.setState({calibrationSlopes: calibrations})
  }
}

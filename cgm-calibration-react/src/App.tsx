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
};

type GlucoseValue = {
  dateString: string;
  sgv: number;
};

class PlotWrapper extends Component<PlotWrapperProps, PlotWrapperState> {
  constructor(props: PlotWrapperProps) {
    super(props);
    this.state = { lastGlucoseValues: [] };
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

  componentDidMount() {
    this.fetchLastThree();
  }

  fetchLastThree() {
    fetch(
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
}

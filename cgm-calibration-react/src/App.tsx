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
      </div>
    );
  }
}

export default App;

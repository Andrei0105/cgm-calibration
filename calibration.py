import matplotlib.pyplot as plt
import numpy as np
from dataclasses import dataclass
from urllib.parse import quote
import pymongo
import configparser
from typing import List

config = configparser.ConfigParser()
config.read('example.ini')

@dataclass
class Point:
    raw: float
    glucose: float

@dataclass
class CalibrationSlope:
    slope: float
    intercept: float

@dataclass
class Sensor:
    start: str
    glucose_points: List[Point]
    calibration_points: List[Point]

class MongoConnector:
    def __init__(self):
        self.client = pymongo.MongoClient('mongodb://' + config['Mongo']['User'] + ':' + quote(config['Mongo']['Password']) + '@' +  config['Mongo']['Address'] + config['Mongo']['Database'])
        self.db = self.client[config['Mongo']['Database']]
        self.col_entries = self.db[config['Mongo']['Col_Entries']]
        self.col_treatments = self.db[config['Mongo']['Col_Treatments']]

    def get_finger_checks(self):
        return list(self.col_treatments.find({ "glucoseType": "Finger" }))

    def get_calibration_finger_checks(self):
        return list(self.col_treatments.find({ "glucoseType": "Finger", 'notes': 'Sensor Calibration' }, {'created_at': 1, 'glucose': 1}).sort("created_at", -1))

    def get_calibration_details(self):
        return list(self.col_entries.find({ "type": "cal" }, {'dateString': 1, "intercept": 1, "slope": 1 }).sort("dateString", -1))

    def get_last_n_nondeleted_calibrations(self, n):
        cal_finger_checks = list(self.col_treatments.find({ "glucoseType": "Finger", 'notes': 'Sensor Calibration' }, { '_id': 0, 'created_at': 1, 'glucose': 1}).sort("created_at", -1).limit(n))
        for cfc in cal_finger_checks:
            cal_details = list(self.col_entries.find({ "type": "cal", 'dateString': cfc['created_at'] }, { 'dateString': 1, "intercept": 1, "slope": 1 }).sort("dateString", -1).limit(1))[0]
            previous_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$lt': cal_details['dateString'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", -1).limit(1))[0]
            next_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$gt': cal_details['dateString'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", 1).limit(1))[0]
            cfc['intercept'] = cal_details['intercept']
            cfc['slope'] = cal_details['slope']
            cfc['unfiltered_prev'] = previous_raw_entry['unfiltered']
            cfc['unfiltered_next'] = next_raw_entry['unfiltered']
            cfc['unfiltered_avg'] = int((previous_raw_entry['unfiltered'] + next_raw_entry['unfiltered']) / 2)
        return cal_finger_checks

    def get_last_n_nondeleted_calibration_slopes(self, n):
        calibrations = self.get_last_n_nondeleted_calibrations(n)
        return [CalibrationSlope(c['slope'], c['intercept']) for c in calibrations]

    def get_last_n_calibrations(self, n):
        calibrations = list(self.col_entries.find({ "type": "cal"}, { 'dateString': 1, "intercept": 1, "slope": 1 }).sort("dateString", -1).limit(n))
        return calibrations

    def get_last_n_calibration_slopes(self, n):
        calibrations = self.get_last_n_calibrations(n)
        return [CalibrationSlope(c['slope'], c['intercept']) for c in calibrations]

    def get_glucose_values(self, n):
        glucose_values = list(self.col_treatments.find({ "glucoseType": "Finger", 'glucose': { '$gt': 70, '$lt': 140 } }, { '_id': 0, 'created_at': 1, 'glucose': 1}).sort("created_at", -1).limit(n))
        for gv in glucose_values:
            previous_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$lt': gv['created_at'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", -1).limit(1))[0]
            next_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$gt': gv['created_at'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", 1).limit(1))[0]
            gv['unfiltered_prev'] = previous_raw_entry['unfiltered']
            gv['unfiltered_next'] = next_raw_entry['unfiltered']
            gv['unfiltered_avg'] = int((previous_raw_entry['unfiltered'] + next_raw_entry['unfiltered']) / 2)
        return glucose_values

    def get_sensor_start_datestrings(self, n):
        sensor_start_list = list(self.col_treatments.find({ "eventType": "Sensor Start" }, { '_id': 0, 'created_at': 1}).sort("created_at", -1).limit(n))
        sensor_start_datestrings = [ ss['created_at'] for ss in sensor_start_list ]
        return sensor_start_datestrings

    def get_sensors(self, number_of_sensors):
        sensors = []
        sensor_starts = self.get_sensor_start_datestrings(number_of_sensors)
        for i, ss in enumerate(sensor_starts):
            sensor = Sensor(start=ss, glucose_points=[], calibration_points=[])
            glucose_values = list(self.col_treatments.find({ "glucoseType": "Finger", 'created_at': { '$gt': ss, '$lt': sensor_starts[i-1] if i > 0 else '2050-06-01T06:53:52.000Z' } }, { '_id': 0, 'created_at': 1, 'glucose': 1, 'notes': 1}).sort("created_at", -1))
            for gv in glucose_values:
                previous_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$lt': gv['created_at'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", -1).limit(1))[0]
                next_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$gt': gv['created_at'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", 1).limit(1))[0]
                gv['unfiltered_prev'] = previous_raw_entry['unfiltered']
                gv['unfiltered_next'] = next_raw_entry['unfiltered']
                gv['unfiltered_avg'] = int((previous_raw_entry['unfiltered'] + next_raw_entry['unfiltered']) / 2)
                sensor.glucose_points.append(Point(raw=gv['unfiltered_avg'], glucose=gv['glucose']))
                if 'notes' in gv and gv['notes'] == 'Sensor Calibration':
                    sensor.calibration_points.append(Point(raw=gv['unfiltered_avg'], glucose=gv['glucose']))
            sensors.append(sensor)
        return sensors

    def get_calibration_points_last_sensor(self):
        sensor_start = self.get_sensor_start_datestrings(1)[0]
        cal_finger_checks = list(self.col_treatments.find({ "glucoseType": "Finger", 'notes': 'Sensor Calibration', 'created_at': { '$gt': sensor_start } }, { '_id': 0, 'notes': 1, 'created_at': 1, 'glucose': 1}).sort("created_at", -1))
        for cfc in cal_finger_checks:
            cal_details = list(self.col_entries.find({ "type": "cal", 'dateString': cfc['created_at'] }, { 'dateString': 1, "intercept": 1, "slope": 1 }).sort("dateString", -1).limit(1))[0]
            previous_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$lt': cal_details['dateString'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", -1).limit(1))[0]
            next_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$gt': cal_details['dateString'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", 1).limit(1))[0]
            cfc['intercept'] = cal_details['intercept']
            cfc['slope'] = cal_details['slope']
            cfc['unfiltered_prev'] = previous_raw_entry['unfiltered']
            cfc['unfiltered_next'] = next_raw_entry['unfiltered']
            cfc['unfiltered_avg'] = int((previous_raw_entry['unfiltered'] + next_raw_entry['unfiltered']) / 2)
        return cal_finger_checks

    def get_calibration_points_previous_sensor(self):
        new_sensor_start, sensor_start = self.get_sensor_start_datestrings(2)
        cal_finger_checks = list(self.col_treatments.find({ "glucoseType": "Finger", 'notes': 'Sensor Calibration', 'created_at': { '$gt': sensor_start, '$lt': new_sensor_start } }, { '_id': 0, 'notes': 1, 'created_at': 1, 'glucose': 1}).sort("created_at", -1))
        for cfc in cal_finger_checks:
            cal_details = list(self.col_entries.find({ "type": "cal", 'dateString': cfc['created_at'] }, { 'dateString': 1, "intercept": 1, "slope": 1 }).sort("dateString", -1).limit(1))[0]
            previous_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$lt': cal_details['dateString'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", -1).limit(1))[0]
            next_raw_entry = list(self.col_entries.find({ 'unfiltered': { '$exists': True }, 'dateString': { '$gt': cal_details['dateString'] }}, { 'dateString': 1, 'unfiltered': 1, 'filtered': 1, 'sgv': 1 }).sort("dateString", 1).limit(1))[0]
            cfc['intercept'] = cal_details['intercept']
            cfc['slope'] = cal_details['slope']
            cfc['unfiltered_prev'] = previous_raw_entry['unfiltered']
            cfc['unfiltered_next'] = next_raw_entry['unfiltered']
            cfc['unfiltered_avg'] = int((previous_raw_entry['unfiltered'] + next_raw_entry['unfiltered']) / 2)
        return cal_finger_checks


def get_slope_and_intercept_two_points(points):
    slope = int((points[0].raw - points[1].raw) / (points[0].glucose - points[1].glucose))
    intercept = int(points[0].raw - points[0].glucose * slope)
    return slope, intercept

def get_raw(slope, intercept, glucose):
    return slope * glucose + intercept

def get_glucose(slope, intercept, raw):
    return (raw - intercept) / slope

def get_fit_from_calibration_values(calibrations):
    if len(calibrations) < 2:
        return None
    cals_x = [cal['glucose'] for cal in calibrations]
    cals_y = [cal['unfiltered_avg'] for cal in calibrations]
    gmin, gmax = min(cals_x), max(cals_x)
    pfit, _ = np.polynomial.Polynomial.fit(cals_x, cals_y, 1, full=True, window=(gmin, gmax), domain=(gmin, gmax))
    return pfit

def plot_calibration_values_and_fit(calibrations, max_glucose, axes):
    pfit = get_fit_from_calibration_values(calibrations)
    for cal in calibrations:
        axes.plot(cal['glucose'], cal['unfiltered_avg'], marker='o', color='red')
    if pfit:
        cals_x = [cal['glucose'] for cal in calibrations]
        cals_x = np.append(cals_x, [0, max_glucose])
        axes.plot(cals_x, pfit(cals_x), label='y=' + str(int(list(pfit)[1])) + 'x + ' + str(int(list(pfit)[0])))
        axes.title.set_text('Calibration graph')
        axes.set_ylim([-50000, 300000])
        axes.set_xlabel('mg/dl', color='#1C2833')
        axes.set_ylabel('raw', color='#1C2833')
        axes.legend(loc='upper left')
        axes.grid(True)

def plot_calibration_slope(calibration_slope, max_glucose, axes):
    glucose = np.linspace(0, max_glucose, max_glucose)
    raw = get_raw(calibration_slope.slope, calibration_slope.intercept, glucose)
    axes.plot(glucose, raw, label='y=' + str(int(calibration_slope.slope)) + 'x + ' + str(int(calibration_slope.intercept)), c=np.random.rand(3,))
    axes.title.set_text('Calibration slope graph')
    axes.set_ylim([-50000, 300000])
    axes.set_xlabel('mg/dl', color='#1C2833')
    axes.set_ylabel('raw', color='#1C2833')
    axes.legend(loc='upper left')
    axes.grid(True)

def plot_calibration_slopes(calibration_slopes, max_glucose, axes):
    for cs in calibration_slopes:
        plot_calibration_slope(cs, max_glucose, axes)
    axes.title.set_text('Multiple slopes graph')
    axes.set_ylim([-50000, 300000])
    axes.set_xlabel('mg/dl', color='#1C2833')
    axes.set_ylabel('raw', color='#1C2833')
    axes.legend(loc='upper left')
    axes.grid(True)

def print_glucose_for_calibration_slopes(reference_slope, calibration_slopes, glucose_values=None):
    glucose_values = [55, 70, 100, 130, 150, 180, 200, 240] if glucose_values is None else glucose_values
    raw_values = [get_raw(reference_slope.slope, reference_slope.intercept, gv) for gv in glucose_values]
    print('Slope:', int(reference_slope.slope), '\tIntercept:', int(reference_slope.intercept))
    print(glucose_values)
    for cs in calibration_slopes:
        print('Slope:', cs.slope, '\tIntercept:', cs.intercept)
        print([int(get_glucose(cs.slope, cs.intercept, rv)) for rv in raw_values])

def get_fit_from_sensor(sensor, calibrations_only=False):
    if calibrations_only:
        points = sensor.calibration_points
    else:
        points = sensor.glucose_points
    glucose = [gp.glucose for gp in points]
    raw = [gp.raw for gp in points]
    gmin, gmax = min(glucose), max(glucose)
    pfit, _ = np.polynomial.Polynomial.fit(glucose, raw, 1, full=True, window=(gmin, gmax), domain=(gmin, gmax))
    return pfit

def plot_sensor(sensor, max_glucose, axes, calibrations_only=False):
    if calibrations_only:
        points = sensor.calibration_points
    else:
        points = sensor.glucose_points
    if len(points) < 2:
        plt.close()
        return
    pfit = get_fit_from_sensor(sensor, calibrations_only)
    for gp in points:
        axes.plot(gp.glucose, gp.raw, marker='o', color='red')
    glucose = [gp.glucose for gp in points]
    glucose = np.append(glucose, [0, max_glucose])
    axes.plot(glucose, pfit(glucose), label='y=' + str(int(list(pfit)[1])) + 'x + ' + str(int(list(pfit)[0])))
    axes.title.set_text('Sensor start: ' + sensor.start)
    axes.set_ylim([-50000, 300000])
    axes.set_xlabel('mg/dl', color='#1C2833')
    axes.set_ylabel('raw', color='#1C2833')
    axes.legend(loc='upper left')
    axes.grid(True)


mc = MongoConnector()

if __name__ == "__main__":
    try:
        # plot a single calibration slope
        figure, axes = plt.subplots()
        plot_calibration_slope(CalibrationSlope(500, 1000), 250, axes)

        # plot multiple calibration slopes
        calibration_slopes = [CalibrationSlope(500, 10000), CalibrationSlope(750, 10000)]
        figure, axes = plt.subplots()
        plot_calibration_slopes(calibration_slopes, 250, axes)

        # plot the last n nondeleted calibration slopes 
        calibration_slopes = mc.get_last_n_nondeleted_calibration_slopes(2)
        figure, axes = plt.subplots()
        plot_calibration_slopes(calibration_slopes, 250, axes)
        # and also print calculated glucose for the calibration slopes, with the most recent one as the reference
        print_glucose_for_calibration_slopes(calibration_slopes[0], calibration_slopes[1:])

        # plot all glucose values and the calibration slope for them
        glucose_values = mc.get_glucose_values(0)
        figure, axes = plt.subplots()
        plot_calibration_values_and_fit(glucose_values, 250, axes)

        # plot the last n nondeleted calibration points and the slope based on them
        calibrations = mc.get_last_n_nondeleted_calibrations(150)
        figure, axes = plt.subplots()
        plot_calibration_values_and_fit(calibrations, 250, axes)

        # plot the last 2 sensors (all glucose values and calibration slope for them)
        for s in mc.get_sensors(2):
            figure, axes = plt.subplots()
            plot_sensor(s, 250, axes)

        # plot all sensors (only calibration values and calibration slope for them)
        for s in mc.get_sensors(0):
            figure, axes = plt.subplots()
            plot_sensor(s, 250, axes, True)

        # plot the last calibration slope and the slope generated from last sensor's values
        sensor = mc.get_sensors(1)[0]
        pfit = get_fit_from_sensor(sensor)
        cs = CalibrationSlope(slope=list(pfit)[1], intercept=list(pfit)[0])
        calibration_slopes = mc.get_last_n_nondeleted_calibration_slopes(1)
        calibration_slopes.append(cs)
        figure, axes = plt.subplots()
        plot_calibration_slopes(calibration_slopes, 250, axes)
        # and also print the glucose values for the 2 slopes, with the last value from spike as reference
        print_glucose_for_calibration_slopes(calibration_slopes[-1], calibration_slopes[:-1])

        # plot last n calibration points and their slope, and the last slope generated by spike
        cps = mc.get_calibration_points_last_sensor()[:2]
        figure, axes = plt.subplots()
        plot_calibration_values_and_fit(cps, 250, axes)
        cfit = get_fit_from_calibration_values(cps)
        cs = mc.get_last_n_nondeleted_calibration_slopes(1)
        plot_calibration_slopes(cs, 250, axes)

        plt.show()
    except KeyboardInterrupt: 
        exit()
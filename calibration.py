import matplotlib.pyplot as plt
import numpy as np
from dataclasses import dataclass
from urllib.parse import quote
import pymongo
import configparser

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


def get_slope_and_intercept_two_points(points):
    slope = int((points[0].raw - points[1].raw) / (points[0].glucose - points[1].glucose))
    intercept = int(points[0].raw - points[0].glucose * slope)
    return slope, intercept

def get_raw(slope, intercept, glucose):
    return slope * glucose + intercept

def get_glucose(slope, intercept, raw):
    return (raw - intercept) / slope

def get_fit_from_calibration_values(calibrations):
    cals_x = [cal['glucose'] for cal in calibrations]
    cals_y = [cal['unfiltered_avg'] for cal in calibrations]
    gmin, gmax = min(cals_x), max(cals_x)
    pfit, _ = np.polynomial.Polynomial.fit(cals_x, cals_y, 1, full=True, window=(gmin, gmax), domain=(gmin, gmax))
    return pfit

def plot_calibration_values_and_fit(calibrations, max_glucose, axes):
    pfit = get_fit_from_calibration_values(calibrations)
    for cal in calibrations:
        plt.plot(cal['glucose'], cal['unfiltered_avg'], marker='o', color='red')
    cals_x = [cal['glucose'] for cal in calibrations]
    cals_x = np.append(cals_x, [0, max_glucose])
    axes.plot(cals_x, pfit(cals_x), label='y=' + str(int(list(pfit)[1])) + 'x + ' + str(int(list(pfit)[0])))
    axes.title.set_text('Calibration graph')
    axes.set_xlabel('mg/dl', color='#1C2833')
    axes.set_ylabel('raw', color='#1C2833')
    axes.legend(loc='upper left')
    axes.grid()

def plot_calibration_slopes(calibration_slopes, max_glucose, axes):
    glucose = np.linspace(0, max_glucose, max_glucose)
    for cs in calibration_slopes:
        raw = get_raw(cs.slope, cs.intercept, glucose)
        axes.plot(glucose, raw, label='y=' + str(cs.slope) + 'x + ' + str(cs.intercept), c=np.random.rand(3,))
    axes.title.set_text('Multiple slopes graph')
    axes.set_xlabel('mg/dl', color='#1C2833')
    axes.set_ylabel('raw', color='#1C2833')
    axes.legend(loc='upper left')
    axes.grid()

def print_glucose_for_calibration_slopes(reference_slope, calibration_slopes, glucose_values=None):
    glucose_values = [55, 70, 100, 130, 150, 180, 200, 240] if glucose_values is None else glucose_values
    raw_values = [get_raw(reference_slope.slope, reference_slope.intercept, gv) for gv in glucose_values]
    print('Slope:', reference_slope.slope)
    print('Intercept:', reference_slope.intercept)
    print(glucose_values)
    for cs in calibration_slopes:
        print('Slope:', cs.slope, '\tIntercept:', cs.intercept)
        print([int(get_glucose(cs.slope, cs.intercept, rv)) for rv in raw_values])


reference_slope = CalibrationSlope(1004, 8331)
slopes_and_intercepts = [ (970, 13481), (1081, 32261), (1714, -76700), (823, 35215), (1175, -16867) ]
calibration_slopes = [CalibrationSlope(si[0], si[1]) for si in slopes_and_intercepts]
print_glucose_for_calibration_slopes(reference_slope, calibration_slopes)

mc = MongoConnector()

cals = mc.get_last_n_nondeleted_calibrations(6)
figure, axes = plt.subplots()
plot_calibration_values_and_fit(cals, 250, axes)

figure2, axes2 = plt.subplots()
plot_calibration_slopes(calibration_slopes, 250, axes2)

plt.show()

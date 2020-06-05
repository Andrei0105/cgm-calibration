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


class MongoConnector:
    def __init__(self):
        self.client = pymongo.MongoClient('mongodb://' + config['Mongo']['User'] + ':' + quote(config['Mongo']['Password']) + '@' +  config['Mongo']['Address'] + config['Mongo']['Database'])
        self.db = self.client[config['Mongo']['Database']]
        self.col_entries = self.db[config['Mongo']['Col_Entries']]
        self.col_treatments = self.db[config['Mongo']['Col_Treatments']]

    def find_finger_checks(self):
        return self.col_treatments.find({ "glucoseType": "Finger" })

def get_slope_and_intercept_two_points(points):
    slope = int((points[0].raw - points[1].raw) / (points[0].glucose - points[1].glucose))
    intercept = int(points[0].raw - points[0].glucose * slope)
    return slope, intercept

def get_raw(slope, intercept, glucose):
    return slope * glucose + intercept

x = np.linspace(0,500,500)

points = [Point(157412, 148), Point(97059, 90)]
slope, intercept = get_slope_and_intercept_two_points(points)
plt.plot(x, slope * x + intercept, '-r', label='y=' + str(slope) + 'x + ' + str(intercept), c='red')

slopes_and_intercepts = [ (1004, 8331), (1237, 4296), (1658, -25469), (702, 46868), (970, 13481)]
for si in slopes_and_intercepts:
    y = get_raw(si[0], si[1], x)
    plt.plot(x, y, '-r', label='y=' + str(si[0]) + 'x + ' + str(si[1]), c=np.random.rand(3,))
plt.title('Calibration graph')
plt.xlabel('mg/dl', color='#1C2833')
plt.ylabel('raw', color='#1C2833')
plt.legend(loc='upper left')
plt.grid()
plt.show()

ref_slope = 1004
ref_intercept = 8331
glucose_values = [55, 70, 100, 130, 150, 180, 200, 240]
raw_values = [get_raw(ref_slope, ref_intercept, gv) for gv in glucose_values]
slopes_and_intercepts = [ (970, 13481), (1081, 32261), (1714, -76700), (823, 35215), (1175, -16867) ]
print(ref_slope, ref_intercept)
print(glucose_values)
for si in slopes_and_intercepts:
    print(si[0], si[1])
    print([int((rv - si[1]) / si[0]) for rv in raw_values])

mc = MongoConnector()
for x in mc.find_finger_checks():
    print(x)
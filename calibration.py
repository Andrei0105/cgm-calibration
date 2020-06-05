import matplotlib.pyplot as plt
import numpy as np
x = np.linspace(0,500,500)
raw = [157412, 97059]
glucose = [148, 90]
# raw = [157412, ]
# glucose = [148, ]
plt.plot(glucose, raw, marker='x', color='red')
slope = int((raw[0] - raw[1]) / (glucose[0] - glucose[1]))
intercept = int(raw[1] - glucose[1]*slope)
slopes_and_intercepts = [ (1004, 8331), (1237, 4296), (1658, -25469), (702, 46868), (970, 13481), (slope, intercept) ]
# slopes_and_intercepts = [ (1004, 8331), (970, 13481), (1081, 32261), (1714, -76700), (823, 35215) ]
for si in slopes_and_intercepts:
    y = si[0]*x + si[1]
    plt.plot(x, y, '-r', label='y=' + str(si[0]) + 'x + ' + str(si[1]), c=np.random.rand(3,))
plt.title('Calibration graph')
plt.xlabel('mg/dl', color='#1C2833')
plt.ylabel('raw', color='#1C2833')
plt.legend(loc='upper left')
plt.grid()
plt.show()


# mongo queries

# {
#     "dateString": {
#         "$regex": "2020-06-03T10:5"
#     }
# }

# {
#    "glucoseType": "Finger"
# }


# 111 129765
# 90 97059
# 90 99 99765

# raw = glucose * slope + intercept
# glucose = (raw - intercept) / slope

ref_slope = 1004
ref_intercept = 8331
glucose_values = [55, 70, 100, 130, 150, 180, 200, 240]
raw_values = [gv * ref_slope + ref_intercept  for gv in glucose_values]
slopes_and_intercepts = [ (970, 13481), (1081, 32261), (1714, -76700), (823, 35215) ]
print(ref_slope, ref_intercept)
print(glucose_values)
for si in slopes_and_intercepts:
    print(si[0], si[1])
    print([int((rv - si[1]) / si[0]) for rv in raw_values])

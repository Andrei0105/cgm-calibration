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


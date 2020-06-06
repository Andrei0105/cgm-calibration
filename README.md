# CGM calibration

I use the code here to explore and analyze continuous glucose monitoring calibration data from Spike app (https://spike-app.com/). 

Read this article to understand what the slope and intercept are and how they work: https://bionicwookiee.com/2018/11/15/cgm-accuracy-calibration-is-king/
Note that in the article the raw and glucose values are reversed compared to Spike.
In Spike, raw values are on the Y axis and ``glucose = (raw - intercept) / slope``, in the article glucose values are on Y axis and ``glucose = raw * slope + intercept``. Thus, in the article, a steeper slope means higher highs and lower lows. In Spike, a steeper slope means lower highs and higher lows.

I use slope to refer both to slope parameter of a straight line, as in ``y = x * slope + intercept``, and to the line itself. What I'm refering to should be obvious from the context (e.g.: steeper refers to the line, higher refers to the parameter).

Spike offers 2 calibration modes:
- fixed slope - where the slope value is always 1000 and only the intercept is changed. Only the last calibration value is used
- non-fixed slope - where the slope value changes based on the calibration values. Spike keeps all calibration values and tries to fit a line through them

In Spike:
- ``raw = glucose * slope + intercept``
- ``glucose = (raw - intercept) / slope``

Some useful MongoDB queries for the Nightscout db:
 - value at a certain date in the ``entries`` collection
``{
    "dateString": {
        "$regex": "2020-06-03T10:5"
    }
}``
- bg check with meter in the ``treatments`` collection
``{
   "glucoseType": "Finger"
}``
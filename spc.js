/**
* Statistical Process Control Chart
*
* @author Chris Rooney
*
* This library draws an SPC chart based on the input data (see
* https://en.wikipedia.org/wiki/Statistical_process_control).
*
* It uses the d3 data visaulisation library - https://d3js.org/
*/
spc = window.spc || {};

spc = function () {

  /* The default size of the data points */
  var ICON_SIZE = 9;

  /**
  * Wrapper for converting a string to date
  * @param {string} format - The data format
  */
  var parseTime = function(format) {
    return d3.timeParse(format);
  };

  /* Default margin sizes */
  var margin = {
    top: 20,
    right: 20,
    bottom: 30,
    left: 50
  };

  /**
  * Draws an SPC chart
  *
  * @param {Array} data - The data to render
  * @param {String} container - The container where the chart will be rendered
  * @param {Object} properties - Properties to configure the SPC chart
  *
  * The properties object maintains persistent information regarding the chart,
  * but can also be used to override defaults. For example:
  * {
  *  "autoDetectProcess" : false, - Speficies whether the process breaks should be inserted manually.
  *  "autoDetectUntil" : d3.max(data, function(d) { return d[properties.xData]}), - If the above is true,
  only do this up to a certain data (this is more used for demonstration purposes).
  *  "chartUpdateCallback" = function(p){ }, - Receive an update if the chart is modified.
  *  "xData" : "Date", - The date data column name
  *  "yData" : "Count" - The count data column name
  * }
  *
  * So that we can resize the chart, we do only data processing and
  * signal detection here, and do the drawing in resizeChart.  Since you many want multiple SPC charts drawn,
  * nothing persists in this library, and is instead stored in the properties object.
  *
  */
  displayChart = function(data, container, properties) {

    /* Clear the container */
    d3.select(container).html("");

    /* Add default properties where not specified */
    configureProperties(properties, data);

    /* Sort the data */
    data.sort(function(a,b) {return a[properties.xData]-b[properties.xData];});

    /* If we have any outliers that we don't want they we strip them from the data */
    var strippedData = [];
    data.forEach(function(d) {
      var add = true;
      for (let i in properties.datesToExclude) {
        if (d[properties.xData] == i) {
          add = false;
        }
      }
      if (add) {
        strippedData.push(d);
      }
    });


    /* Add the SVG container to the parent container */
    var g = d3.select(container).append("svg")
    .attr("width", '100%')
    .attr("height", '100%')
    .append("g")
    .attr("transform", "translate(" + margin.left  + "," + margin.top + ")");

    /* We store the x and y scales and axes in the properties object so we can resize. */
    properties.x = d3.scaleUtc().rangeRound([0, 0]);
    properties.y = d3.scaleLinear().rangeRound([0, 0]),
    properties.x.domain(d3.extent(data, function(d) {
      return d[properties.xData];
    }));
    properties.xAxis = d3.axisBottom(properties.x);
    properties.xAxis.ticks(8);
    g.append("g")
    .attr("class", "axis spc__axis--x");
    properties.yAxis = d3.axisLeft(properties.y);
    var axisY = g.append("g");
    axisY.attr("class", "axis spc__axis--y")
    .append("text")
    .attr("fill", "#000")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", "0.71em")
    .style("text-anchor", "end")
    .text("Count");

    /* We add a line that shows the x poistion of the cursor */
    g.append("line").classed("spc__hoverLine", true);

    /* We add a groups that contains all the control lines and process break lines */
    var processLines = g.append("g").classed("spc__processLines", true);
    var controlLines = g.append("g");

    /* Append each data point */
    var dataDots = g.selectAll("dot").data(data)
    .enter().append("g");
    dataDots.attr("class", "spc__point")
    .attr("v", function(d) {
      return d[properties.xData];
    })
    .on("click", function() {
      /* When we click on a data point, toggler whether is should be omitted */
      var d1 = d3.select(this).attr("v");
      if (d1 in properties.datesToExclude) {
        delete properties.datesToExclude[d1];
        d3.select(container).html("");
        properties.chartUpdateCallback(properties);
        displayChart(data, container, properties);
      } else {
        properties.datesToExclude[d1] = true;
        d3.select(container).html("");
        properties.chartUpdateCallback(properties);
        displayChart(data, container, properties);
      }
      d3.event.stopPropagation();
    });


    d3.select(container).select("svg")
    .on("mousemove", function() {
      /* Move the hover line when we move the cursor */
      var x = d3.mouse(this)[0]-margin.left;
      if (x > 0) {
        d3.select(this).select(".spc__hoverLine").style("display", null);
        d3.select(this).select(".spc__hoverLine").attr("x1", x).attr("x2", x);
      } else {
        d3.select(this).select(".spc__hoverLine").style("display", "none");
      }
    })
    .on("mouseout", function() {
      d3.select(this).select(".spc__hoverLine").style("display", "none");
    })
    .on("click", function() {
      /* Create a new process when we click on the chart */
      if (properties.autoDetectProcess) {
        window.alert("Process breaks can only be set when automatic detection is disabled");
      } else {
        var xDate = properties.x.invert(d3.mouse(this)[0]-margin.left);
        xDate = d3.bisector(function(d) { return d[properties.xData]; }).right(data, xDate, 1);
        if (properties.manualProcesses.indexOf(xDate) === -1 && xDate < properties.dates.length) {
          properties.manualProcesses.push(xDate);
          properties.chartUpdateCallback(properties);
          displayChart(data, container, properties);
        }
      }
    });

    if (properties.manualProcesses.length == 0  || properties.autoDetectProcess) {
      /* If we don't have any process breaks, or we want to autodetect the processes, only create one process to start */
      createProcess(properties.processes, 0);
    } else {
      /* Otherwise, create the manual process breaks */
      var prev = 0;
      for (let i = 0; i < properties.manualProcesses.length; ++i) {
        var p = properties.manualProcesses[i];
        createProcess(properties.processes, prev, p-1);
        if (i == properties.manualProcesses.length - 1 ) {
          createProcess(properties.processes, p, data.length-1);
        }
        prev = p;
      }
    }

    /* Calculate the signals for each process (we do this iteratively) */
    calculateSignals(data, properties.processes, 0, properties.autoDetectProcess, properties.autoDetectUntil, properties.datesToExclude);

    /* Track the min and max y value so we can set our axis */
    var maxY = 0, minY = Number.MAX_SAFE_INTEGER;

    /* Loop through each process  */
    for (let i = 0; i < properties.processes.length; ++i) {
      var process = properties.processes[i];
      process.startDate = data[process.startIndex][properties.xData];
      process.endDate = data[process.endIndex][properties.xData];

      /* Define the process lines */
      if (!process.startIndex == 0) {
        processLines.append("line").classed("processLine_" + process.startIndex, true);
        processLines.append("circle").classed("processSelection_" + process.startIndex, true)
        .attr("v", process.startIndex)
        .on("click", function() {
          val = d3.select(this).attr("v");
          for (let v in properties.manualProcesses) {
            if (properties.manualProcesses[v] == val) {
              properties.manualProcesses.splice(v,1);
              properties.chartUpdateCallback(properties);
              displayChart(data, container, properties);
            }
            d3.event.stopPropagation();
          }
        });
      }

      /* Define the control lines */
      for (let i in ControlLinesEnum) {
        g.append("line")
        .attr("class", "spc__limit " + ControlLinesEnum[i].id + "_" + process.startIndex)
        .attr("stroke-dasharray", ControlLinesEnum[i].dash);
      }
      controlLines.append("path").datum(data.slice(process.startIndex, process.endIndex+1))
      .attr("class", "spc__line spc__line_" + process.startIndex);

      /* Draw either a normal data point or a signal */
      dataDots.filter(function (d) {
        for (let datum of data.slice(process.startIndex, process.endIndex+1)) {
          if (datum[properties.xData] == d[properties.xData]) {
            return true;
          }
        }
        return false;
      }).each(function(d) {
        d3.select(this).attr("transform", "translate(" + properties.x(d[properties.xData]) + "," + properties.y(d[properties.yData]) + ")");
        if (d[properties.xData] in properties.datesToExclude ) {
          d3.select(this).append("circle")
          .attr("cx", 0)
          .attr("cy", 0)
          .attr("r" , ICON_SIZE * 0.5)
          .attr("fill", "grey");
        } else if (d[properties.xData] in properties.processes[i].signals) {
          SignalEnum[properties.processes[i].signals[d[properties.xData]]].shape(d3.select(this), 0, 0, ICON_SIZE);
        } else {
          d3.select(this).append("rect")
          .attr("x", function(d) {
            return ICON_SIZE * -0.5;
          })
          .attr("y", function(d) {
            return ICON_SIZE * -0.5;
          }).attr("width" , ICON_SIZE).attr("height" , ICON_SIZE);
        }

      });

      /* Detect the max and min control limits */
      if (process.mean + 3.5 * process.sd > maxY) {
        maxY = process.mean + 3.5 * process.sd;
      }
      if (process.mean - 3.5 * process.sd < minY) {
        minY = process.mean - 3.5 * process.sd;
      }
    }

    /* Update the y domain based on the min and max limits */
    properties.y.domain([minY, maxY]);

    /* Draw the chart */
    resizeChart(container, properties);
  };

  /**
  * Internal function for creating a new process (either manually or automatically).
  *
  * @param {Array} processes - The current processes
  * @param {int} index - The start index of the processes
  * @param {int} cap - The end index
  */
  createProcess = function(processes, index, cap = -1) {
    /* We start with a minimum end index of the start index +
    the length of the eight-over-mean process (which is the signal
    that triggers an automatic process break) */
    var endIndex = index + SignalEnum.EIGHT_OVER_MEAN.length;
    if (cap > -1 && endIndex > cap) {
      /* If this exceeds the cap then reduce the end index */
      endIndex = cap;
    }

    /* Add the process */
    processes.push({
      "startIndex" : index,
      "endIndex" : endIndex,
      "cap" : cap
    });
    /* If we have more than one process, then cap the
    previous process to the start of this one */
    if (processes.length > 1) {
      processes[processes.length - 2].endIndex = index - 1;
    }
  }


  /**
  * Resize an existing SPC chart
  *
  * @param {String} container - The container where the chart is rendered
  * @param {Object} properties - Properties to configure the SPC chart
  */
  resizeChart = function(container, properties) {

    /* Define the width and height of the chart */
    var main = d3.select(container);
    var box = d3.select(container).node().getBoundingClientRect();
    var width = box.width - margin.right - margin.left;
    var height = box.height - margin.top - margin.bottom;

    /* Position the X axis */
    main.select(".spc__axis--x")
    .attr("transform", "translate(0," + height + ")")

    /* Set the range of the x and y axes */
    properties.x.rangeRound([0, width]);
    properties.y.rangeRound([height, 0]);

    /* Define the number of ticks based on the size of the chart */
    properties.xAxis.ticks(width / 100);
    main.select(".spc__axis--x").call(properties.xAxis);
    properties.yAxis.ticks(height / 50  );
    main.select(".spc__axis--y").call(properties.yAxis);

    /* Create a line function for this chart */
    var line = d3.line()
    .x(function(d) {
      return properties.x(d[properties.xData]);
    })
    .y(function(d) {
      return properties.y(d[properties.yData]);
    });

    /* Position the data points */
    main.selectAll(".spc__point").each(function(d) {
      d3.select(this).attr("transform", "translate(" + properties.x(d[properties.xData]) + "," + properties.y(d[properties.yData]) + ")");
    });

    /* Position the process break lines and control limit lines */
    for (let j of properties.processes ) {
      setLinePos(main.select(".processLine_" + j.startIndex), properties.x(j.startDate), 0, properties.x(j.startDate), height);
      main.select(".processSelection_" + j.startIndex).attr("cx", properties.x(j.startDate)).attr("cy", 0.5 * ICON_SIZE).attr("r", 0.5*ICON_SIZE);
      for (let i in ControlLinesEnum) {
        if (j.startDate != j.endDate) {
          setLinePos(main.select("." + ControlLinesEnum[i].id + "_" + j.startIndex), properties.x(j.startDate),
          properties.y(j.mean + ControlLinesEnum[i].index * j.sd), properties.x(j.endDate), properties.y(j.mean + ControlLinesEnum[i].index * j.sd));
        }
      }
      main.select(".spc__line_" + j.startIndex).attr("d", line);
    }
    main.select(".spc__hoverLine").attr("y1", 0).attr("y2", height);
  };

  /**
  * Get the signal data without rendering the chart
  *
  * @param {Array} data - The data to render
  * @param {Object} properties - Properties to configure the signal processing
  */
  getSignals = function(data, properties) {
    configureProperties(properties, data);
    createProcess(properties.processes, 0);
    calculateSignals(data, properties.processes, 0, properties.autoDetectProcess, properties.autoDetectUntil, properties.datesToExclude);
  }

  /**
  * Internal function for detecting signals and process breaks
  *
  * @param {Array} data - The data to render
  * @param {Object} processes - Existing processes
  * @param {int} pIndex - The current process
  * @param {bool} autoDetectProcess - Whether to auto detect process breaks
  * @param {Date} autoDetectUntil - The limit for auto detecting process breaks
  * @param {Array} datesToExclude - A list of dates to exclude
  */
  calculateSignals = function(data, processes, pIndex, autoDetectProcess, autoDetectUntil, datesToExclude) {
    /* Get the current process */
    var process = processes[pIndex];
    var signalTracker = {};
    process.signals = {};

    /* Cap the end of the process to the last data point, otherwise decrement it by one */
    if (process.endIndex >= data.length) {
      process.endIndex = data.length - 2;
    } else {
      process.endIndex--;
    }

    /* We both detect signals and process breaks here. So we need a bit of trickery to define when we enter this loop.
    *
    * This process is not very efficient since we need to add one data point at a time to detect whether there has beena process break.
    * Since the new data point changes the summary statistics, we need to check all data points every time we add a new one.  This gives
    * us a running time close to O(n^2).
    *
    */
    var processFound = false;
    while (!processFound && process.endIndex < data.length -1 && (process.cap == -1 || process.endIndex < process.cap) ) {
      /* Reset the signal tracking variables and increase the end index by one (inlude a new data point) */
      process.endIndex++;
      process.signals = {};
      signalTracker = {};
      for (let i in SignalEnum) {
        signalTracker[SignalEnum[i].id] = [];
      };

      /* generate summary statistics */
      var stats = summaryStatistics(data, datesToExclude, process.startIndex, process.endIndex);
      process.mean = stats.mean;
      process.sd = stats.sd;

      /* Loop through all the points in reverse order */
      for (var j = process.endIndex; j >= process.startIndex; --j) {
        var d = data[j];
        if (!(d[properties.xData] in datesToExclude)) {
          for (let i in SignalEnum) {
            var sig = SignalEnum[i];
            /* Check whether any data points are classified as a signal */
            if (sig.rule(d[properties.yData], process.mean, process.sd)) {
              /* Check whether a run has been detected, or a new process break should be inserted */
              processFound =  incrementSignal(signalTracker, sig, d[properties.xData], processes, j, j == process.startIndex ? false : autoDetectProcess, autoDetectUntil);
            } else {
              /* Otherwise, clear the run */
              clearSignal(process.signals, signalTracker, sig);
            }
            /* If we have a process break, exit the loop */
            if (processFound) {
              break;
            }
          }
          if (processFound) {
            break;
          }
        }
      }

      if (processFound) {
        /* If we have found a new process, regenerate the summary stats excluding the data points from the latest signal */
        var stats = summaryStatistics(data, datesToExclude, process.startIndex, process.endIndex);
        process.mean = stats.mean;
        process.sd = stats.sd;
      }
    }

    /* We flush out any remaining signals from our signal tracker */
    for (let i in SignalEnum) {
      var val = SignalEnum[i];
      if (val.id in signalTracker) {
        addSignalToTracker(process.signals, signalTracker, val);
      }
    };

    /* If we have found a process, or we are working through multiple processes, then we recall this function */
    if (processFound || pIndex < processes.length - 1) {
      calculateSignals(data, processes, pIndex + 1, autoDetectProcess, autoDetectUntil, datesToExclude);
    }
  };

  /**
  * Internal - Generate the mean.
  *
  * @param {Array} data - the data Array
  */
  mean = function(data) {
    return d3.mean(data, function(d) {
      return d[properties.yData];
    });
  }

  /**
  * Internal- Generate the standard deviation.
  *
  * @param {Array} data - the data Array
  */
  sd = function(data) {
    return d3.deviation(data, function(d) {
      return d[properties.yData];
    });
  }

  /**
  * Internal - Generate summary statistics from a subset of the data.
  *
  * @param {Array} data - the data Array
  * @param {Array} datesToExclude - an array out outliers
  * @param {int} start - the start inedex (inclusive)
  * @param {int} end - the end index (exclusive)
  */
  summaryStatistics = function(data, datesToExclude, start, end) {
    stats = {"mean" : 0, "sd" : 0};
    end++;
    if (isEmpty(datesToExclude)) {
      stats.mean = mean(data.slice(start,  end));
      stats.sd = sd(data.slice(start, end));
    } else {
      var tmpData = [];
      for (let i = start; i < end; i++) {
        if (!(data[i][properties.xData] in datesToExclude)) {
          tmpData.push(data[i]);
        }
        stats.mean = mean(tmpData);
        stats.sd = sd(tmpData);
      }
    }
    return stats;
  }

  /*
  * Internal - if we have a signal, incretment the tracker.  If we are detecting process breaks and we find one,
  * create a new process and return true.
  */
  incrementSignal = function(signalTracker, signalType, id, processes, index, autoDetectProcess, autoDetectUntil) {
    signalTracker[signalType.id].push(id);

    if ((signalType.id == SignalEnum.EIGHT_OVER_MEAN.id || signalType.id == SignalEnum.EIGHT_UNDER_MEAN.id) &&
    signalTracker[signalType.id].length == SignalEnum.EIGHT_OVER_MEAN.length  && autoDetectProcess && new Date(id) < new Date(autoDetectUntil)) {
      createProcess(processes, index);
      return true;
    }
    return false;
  }

  /*
  * Internal - Clear a run of signals if below the expected threshold.
  */
  clearSignal  = function(signals, signalTracker, signalType) {
    addSignalToTracker(signals, signalTracker, signalType);
    signalTracker[signalType.id] = [];
  }

  /*
  * Add a new signal to the tracker.
  */
  addSignalToTracker = function(signals, signalTracker, signalType) {
    if (signalTracker[signalType.id].length >= signalType.length) {
      signalTracker[signalType.id].forEach(function (d) {
        if ((d in signals && signalType.length < SignalEnum[signals[d]].length) || !(d in signals)) {
          signals[d] = signalType.id;
        }
      });
    }
  }

  /*
  * Internal - Set the position of a line
  */
  setLinePos = function(e, x1, y1, x2, y2) {
    e.attr("x1", x1)
    .attr("y1", y1)
    .attr("x2", x2)
    .attr("y2", y2);
  }

  /*
  * Check whether an object has any children.
  *
  * @param {Object} obj - The object to check.
  */
  isEmpty = function(obj) {
    for(let prop in obj) {
      if(obj.hasOwnProperty(prop))
      return false;
    }
    return true;
  }

  /*
  * Internal - Configure the properties object based on a default.
  */
  configureProperties = function(properties, data) {
    defaultProperties = {
      "processes" : [],
      "manualProcesses" : [],
      "autoDetectProcess" : false,
      "datesToExclude" : {},
      "autoDetectUntil" : 0,
      "dates" : [],
      "yData" : "Count",
      "xData" : "Date",
      "chartUpdateCallback" : function(p){}
    }

    defaultProperties.autoDetectUntil = d3.max(data, function(d) { return d[defaultProperties.xData]}),

    data.forEach(function(d) {
      defaultProperties.dates.push(d[defaultProperties.xData]);
    })

    for (let key of Object.keys(defaultProperties)) {
      if (!(key in properties)) {
        properties[key] = defaultProperties[key];
      }
    }

    properties.manualProcesses.sort(function(a, b) {
      return a - b;
    });

    properties.processes = [];

  }

  /**
  * Control line definitions
  */
  ControlLinesEnum = {
    UCL3_LINE : {id: "UCL3_LINE", index : 3, "dash": "0"},
    UCL2_LINE : {id: "UCL2_LINE", index : 2, "dash": "5, 5"},
    UCL1_LINE : {id: "UCL1_LINE", index : 1.5, "dash": "10, 10"},
    MEAN_LINE : {id: "spc__MEAN_LINE", index : 0, "dash": "0"},
    LCL1_LINE : {id: "LCL1_LINE", index : -1.5, "dash": "10, 10"},
    LCL2_LINE : {id: "LCL2_LINE", index : -2, "dash": "5, 5"},
    LCL3_LINE : {id: "LCL3_LINE", index : -3, "dash": "0"}
  }

  /**
  * Check whether a signal is above or below the mean.
  *
  * @param {SignalEnum} sig - The signal to check.
  */
  signalIsBelow = function(sig) {
    if (SignalEnum[sig].rule(0,1,0)) {
      return true;
    }
    return false;
  }

  /*
  * Signal definitions
  */
  SignalEnum = {
    EIGHT_OVER_MEAN : { "id" : "EIGHT_OVER_MEAN", "length" : 8, "index" : 4, "rule" : function(v,mean, sd = 0) {
      if (v > mean) {
        return true;
      }
      return false;
    }, "shape" : function (container, x, y, size) {
      createCross(size, x, y, container, "#00BDA6");
    },
    "desc" : "Eight data points in a row over the mean"},
    EIGHT_UNDER_MEAN : { "id" : "EIGHT_UNDER_MEAN", "length" : 8, "index" : 3, "rule" : function(v,mean, sd = 0) {
      if (v < mean) {
        return true;
      }
      return false;
    }, "shape" : function (container, x, y, size) {
      createDiamond(size, x, y, container, "#00BDA6");
    },
    "desc" : "Eight data points in a row under the mean"},
    TWO_OVER_TWO : { "id" : "TWO_OVER_TWO", "length" : 2, "index" : 6, "rule" : function(v,mean,sd) {
      if (v > mean + sd * 2) {
        return true;
      }
      return false;
    }, "shape" : function (container, x, y, size) {
      createCross(size, x, y, container, "#22919E");
    },
    "desc" : "Two data points in a row over 2 standard deviations above the mean"},
    TWO_UNDER_TWO : { "id" : "TWO_UNDER_TWO", "length" : 2, "index" : 1, "rule": function(v,mean, sd) {
      if (v < mean - sd * 2) {
        return true;
      }
      return false;
    }, "shape" : function (container, x, y, size) {
      createDiamond(size, x, y, container, "#22919E");
    },
    "desc" : "Two data points in a row over 2 standard deviations below the mean"},
    THREE_OVER_ONE_FIVE : { "id" : "THREE_OVER_ONE_FIVE", "length" : 3, "index" : 5, "rule": function(v,mean, sd) {
      if (v > mean + sd * 1.5) {
        return true;
      }
      return false;
    }, "shape" : function (container, x, y, size) {
      createCross(size, x, y, container, "#ff7c40");
    },
    "desc" : "Three data points in a row over 1.5 standard deviations above the mean"},
    THREE_UNDER_ONE_FIVE : { "id" : "THREE_UNDER_ONE_FIVE", "length" : 3, "index" : 2, "rule": function(v,mean, sd) {
      if (v < mean - sd * 1.5) {
        return true;
      }
      return false;
    }, "shape" : function (container, x, y, size) {
      createDiamond(size, x, y, container, "#ff7c40");
    },
    "desc" : "Three data points in a row over 1.5 standard deviations below the mean"},
    ONE_OVER_THREE : { "id" : "ONE_OVER_THREE", "length" : 1,  "index" : 7, "rule": function(v,mean, sd) {
      if (v > mean + sd*3) {
        return true;
      }
      return false;
    }, "shape" : function(container, x, y, size) {
      createCross(size, x, y, container, "#eb4551");
    },
    "desc" : "One data point over 3 standard deviations above the mean"},
    ONE_UNDER_THREE: { "id" : "ONE_UNDER_THREE", "length" : 1,  "index" : 0, "rule": function(v,mean, sd) {
      if (v < mean - sd * 3) {
        return true;
      }
      return false;
    }, "shape" : function(container, x, y, size) {
      createDiamond(size, x, y, container, "#eb4551");
    },
    "desc" : "One data point over 3 standard deviations below the mean"}
  }

  /**
  * Drawing functions
  **/

  createCircle = function(size, x, y, container, colour) {
    container.append("circle")
    .attr("cx", function(d) {
      return x;
    })
    .attr("cy", function(d) {
      return y;
    })
    .attr("r", size / 2)
    .attr("fill", colour);
  }

  createDiamond = function(size, x, y, container, colour) {
    var r = size / 2;
    container.append('polyline')
    .attr('points', function(d) {
      return (-r+x) +  " " + y
      + " " + x + " " + (-r + y)
      + " " + (r+x) + " " + y
      + " " + x +  " " + (r+y)
      + " " + (-r+x) + " " + y;
    } )
    .attr("fill", colour);
  }

  createTriangle = function(size, x, y, container, colour) {
    var r = size / 2;
    container.append('polyline')
    .attr('points', function(d) {
      return (-r+x) +  " " + (r+y)
      + " " + (r+x) + " " + (r+y)
      + " " + x + " " + (-r+y)
      + " " + (-r+x) + " " + (r+y);
    })
    .attr("fill", colour);
  }

  createCross = function(size, x, y, container, colour) {
    var s = 1.0 / size * (size / 2.5);
    var r = size / 2;

    container.append("polyline")
    .attr('points', function(d) {
      return  (x - r)            + " " + (y - (1-s) * r)      // left      , above middle
      + " " + (x - (1-s)*r)    + " " + (y - r)                // near left , top
      + " " + x                + " " + (y - s * r)          // middle , above middle
      + " " + (x + ((1-s)* r)) + " " + (y - r)              // near right, top
      + " " + (x + r)          + " " + (y - r + (s * r))    // right, near top
      + " " + (x + s * r)      + " " + y                    // right of middle, middle
      + " " + (x + r)          + " " + (y + r - (s * r))    // right, near bottom
      + " " + (x + ((1-s)* r)) + " " + (y + r)              // near right, bottom
      + " " + x                + " " + (y + s * r)          // middle, below middle
      + " " + (x - (1-s)*r)    + " " + (y + r)                // near left, bottom
      + " " + (x - r)           + " " + (y + (1-s) * r)       // left, near bottom
      + " " + (x - s * r)      + " " + y                    // left of middle, middle
      + " " + (x - r)           + " " + (y - (1-s) * r);      // left      , near top
    } )
    .attr("fill", colour);
  }

  /**
  * Draw the signal details
  *
  * @param {String} container - The container housing the legend
  */
  drawLegend = function(container) {
    var svg = d3.select(container).append("svg").attr("width", '100%')
    .attr("height", '100%');

    var width = d3.select(container).node().getBoundingClientRect().width;
    var height = d3.select(container).node().getBoundingClientRect().height;

    var sigArray = Object.keys(SignalEnum).map(function (key) { return SignalEnum[key]; });
    sigArray.sort(function(a,b) { return b.length - a.length });
    var numEntries = sigArray.length;
    var boxH = height / numEntries;

    var c = 0;
    for (let sig of sigArray) {
      sig.shape(svg, 0.5 * boxH, 0.5 * boxH +  c * boxH, ICON_SIZE);
      svg.append("text")
      .attr("x", boxH)
      .attr("y", c * boxH + (0.5 * boxH))
      .attr("width", width - boxH)
      .attr("height", boxH)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "central")
      .text(sig.desc)
      c++;
    }
  }

  /**
  * Declare public functions
  */
  return {
    "parseTime" :  parseTime,
    "displayChart" : displayChart,
    "resizeChart" : resizeChart,
    "getSignals" : getSignals,
    "isEmpty" : isEmpty,
    "signalIsBelow" : signalIsBelow,
    "SignalEnum" : SignalEnum,
    "drawLegend" : drawLegend
  }

}();

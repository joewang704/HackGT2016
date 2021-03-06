var svg = d3.select("#histo")


function changeHist(d) {
  var data = d.toPlot
  var names = d.names
  var xData = names

var dataIntermediate=names.map(function(key,i){
    return data.map(function(d,j) {
        return {x: d['hour'], y: d[key], q: names[i], f: d['tot']}
    })
})
var margin = {top: 20, right: 50, bottom: 30, left: 50},
        width = 800 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

var x = d3.scale.ordinal()
        .rangeRoundBands([0, width], .3);

var y = d3.scale.linear()
        .rangeRound([height, 0]);

var color = d3.scale.category20();


var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

var svg = d3.select("#graphs").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


var dataStackLayout = d3.layout.stack()(dataIntermediate);

x.domain(dataStackLayout[0].map(function (d) {
    return d.x;
}));

y.domain([0,
    d3.max(dataStackLayout[dataStackLayout.length - 1],
            function (d) { return d.y0 + d.y;})
    ])
  .nice();

var layer = svg.selectAll(".stack")
        .data(dataStackLayout)
        .enter().append("g")
        .attr("class", "stack")
        .style("fill", function (d, i) {
            return color(i);
        });

var tooltip = d3.tip()
    .attr('class', 'd3-tip')
    .offset([-10, 0])
    .html(function(d) {
      return "<strong>" + d.q + "</strong> <span style='color:red'>" + Math.floor((100.0 * d.y)/d.f)  + "%</span>";
    })
svg.call(tooltip)
layer.selectAll("rect")
        .data(function (d) {
            return d;
        })
        .enter().append("rect")
        .attr("x", function (d) {
            return x(d.x);
        })
        .attr("y", function (d) {
            return y(d.y + d.y0);
        })
        .attr("height", function (d) {
            return y(d.y0) - y(d.y + d.y0);
        })
        .attr("width", x.rangeBand())
        .on('mouseover', tooltip.show)
        .on('mouseout', tooltip.hide)

svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
      .selectAll("text")
        .attr("y", 0)
        .attr("x", 9)
        .attr("dy", ".35em")
        .attr("transform", "rotate(80)")
        .style("text-anchor", "start")

svg.append("text")
	.attr("x", (width / 2))
	.attr("y", 0)
	.attr("text-anchor", "middle")
	.style("font-size", "20px")
	.text("Group Activity By Time of Day");
}


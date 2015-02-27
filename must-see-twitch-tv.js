Subscribers = new Mongo.Collection("subscribers");
PollResults = new Mongo.Collection("poll-results");

if (Meteor.isClient) {
	var data = [
		{
			value: 1,
			color:"#F7464A",
			highlight: "#FF5A5E",
			label: "A"
		},
		{
			value: 1,
			color: "#46BFBD",
			highlight: "#5AD3D1",
			label: "B"
		},
		{
			value: 1,
			color: "#FDB45C",
			highlight: "#FFC870",
			label: "C"
		},
		{
			value: 1,
			color: "#0000AA",
			highlight: "#0000FF",
			label: "D"
		}
	]
	var options = {
		//Boolean - Whether we should show a stroke on each segment
		segmentShowStroke : true,
		//String - The colour of each segment stroke
		segmentStrokeColor : "#fff",
		//Number - The width of each segment stroke
		segmentStrokeWidth : 2,
		//Number - The percentage of the chart that we cut out of the middle
		percentageInnerCutout : 50, // This is 0 for Pie charts
		//Number - Amount of animation steps
		animationSteps : 50,
		//String - Animation easing effect
		animationEasing : "easeOutBounce",
		//Boolean - Whether we animate the rotation of the Doughnut
		animateRotate : true,
		//Boolean - Whether we animate scaling the Doughnut from the centre
		animateScale : false,
		//String - A legend template
		legendTemplate : "<% for (var i=0; i<segments.length; i++){%><div style=\"width: 10px; background-color:<%=segments[i].fillColor%>\"><%if(segments[i].label){%><%=segments[i].label%><%}%></div><%}%>"
	};


	$(document).ready(function() {
		var ctx = document.getElementById("myChart").getContext("2d");
		var myDoughnutChart = new Chart(ctx).Doughnut(data, options);

		$(".new-subscription, .new-donation").on("click", function() {
			$(this).hide();
		});

		var s = Snap(300, 500);
		var dimensions = {
			width: 300,
			height: 60,
			margin: 10
		};
		var notification_nodes = [];

		function PopNode() {
			notification_nodes[notification_nodes.length - 1].animate(
				{"transform": "translate(0,500)", "fill-opacity": 0}
				, 1000
				, mina.easein)

			notification_nodes.pop();
		}

		function AddNode(name) {
			var notification_height = (dimensions.height + dimensions.margin);
			// move add node at negative pos
			var ypos = -1 * (notification_height);
			var rect = s.rect(0, ypos, dimensions.width, dimensions.height);
			var text = s.text(35, ypos+35, name);

			text.attr({
				fill: "#FFF",
				"font-size": "20px"
			});

			var group = s.group(rect, text);
			notification_nodes = [group].concat(notification_nodes); // Put it at the beginning

			// slide all existing nodes down
			for(var i = 0; i < notification_nodes.length; i++) {
				var newpos = (notification_height * (i + 1))
				notification_nodes[i].animate(
					{"transform": "translate(0," + newpos + ")"}
					, 500
					, mina.easein)
			}

			if(notification_nodes.length > 5)
				PopNode();
		}

		AddNode("SCALAWAG 007");
		AddNode("TOAST");
		AddNode("ADDMITT");

		$("#add-notification").on("click", function() {
			AddNode("FOOBAR");
		});

		$("#pop-notification").on("click", function() {
			PopNode();
		});

		Meteor.autosubscribe(function() {
			Subscribers.find().observe({
				added: function(sub) {
					AddNode(sub.username);
				}
			});

			PollResults.find().observe({
				added: function(results) {
					Session.set("LatestPollResult", results);
					console.log(results);
					console.log(myDoughnutChart.segments);
					myDoughnutChart.segments[0].value = results.A;
					myDoughnutChart.segments[1].value = results.B;
					myDoughnutChart.segments[2].value = results.C;
					myDoughnutChart.segments[3].value = results.D;
					myDoughnutChart.update();
				}
			});
		});
	});

	Template.body.helpers({
		PollQuestion: "Chat Poll",
		PollResults: function() { return Session.get("LatestPollResult") }
	});
}

if (Meteor.isServer) {

	var Results = {
		A: 1,
		B: 1,
		C: 1,
		D: 1
	}

  Meteor.startup(function () {
    // code to run on server at startup
	irc = Meteor.npmRequire("irc");

	Subscribers.remove({});
	PollResults.remove({});

	var client = new irc.Client('irc.twitch.tv', 'agscala', {
		channels: ['#northernlion'],
		sasl: true,
		username: "agscala",
		password: "oauth:o3qzmv5do28rocpuey1d5kz0e8goai"
	});

	var callback = Meteor.bindEnvironment(function(from, to, message) {
		if(message.indexOf("Kappa") != -1) {
			console.log(from + ' => ' + to + ': ' + message);

			Subscribers.insert({
				username: from,
				message: message
			});
		}

		UpdatedResults = Results;

		if(message.indexOf("a") != -1) { // VOTE A
			UpdatedResults.A = UpdatedResults.A + 1;
		}

		if(message.indexOf("j") != -1) { // VOTE B
			UpdatedResults.B = UpdatedResults.B + 1;
		}

		if(message.indexOf("z") != -1) { // VOTE C
			UpdatedResults.C = UpdatedResults.C + 1;
		}

		if(message.indexOf("q") != -1) { // VOTE D
			UpdatedResults.D = UpdatedResults.D + 1;
		}

		PollResults.insert(UpdatedResults)
	});

	client.addListener('message', callback);
  });
}


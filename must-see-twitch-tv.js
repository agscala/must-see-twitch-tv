Messages = new Mongo.Collection("messages");
Subscribers = new Mongo.Collection("subscribers");
Donations = new Mongo.Collection("donations");
PollResults = new Mongo.Collection("poll-results");

var PollManager = function() {
	this.questions = [
		{
			question: "Best Tootsie Pop?",
			answers: ["chocolate", "grape"]
		},
		{
			question: "ROLO TONY",
			answers: ["BROWN", "TOWN"]
		},
		{
			question: "Which is worse?",
			answers: ["Sonic", "Satan"]
		},
	];

	this.currentQuestionIndex = 0;

	this.timePerQuestion_ms = 1000 * 60 * 5; // 5 minutes in milliseconds

	this.startTime = moment();

	this.resultState = {
		A: {
			answer: this.questions[this.currentQuestionIndex].answers[0],
			count: 0,
		},
		B: {
			answer: this.questions[this.currentQuestionIndex].answers[1],
			count: 0,
		}
	};
}

PollManager.prototype.getCurrentQuestion = function() {
	this.update();

	return this.questions[this.currentQuestionIndex].question;
}

PollManager.prototype.resetResults = function(questionIndex) {
	this.currentQuestionIndex = questionIndex;

	this.resultState = {
		A: {
			answer: this.questions[this.currentQuestionIndex].answers[0],
			count: 0,
		},
		B: {
			answer: this.questions[this.currentQuestionIndex].answers[1],
			count: 0,
		}
	};
}

PollManager.prototype.update = function() {
	var timeElapsed_ms = moment().diff(this.startTime);
	var QuestionIndex = Math.round(timeElapsed_ms / this.timePerQuestion_ms) % this.questions.length;

	if(QuestionIndex !== this.currentQuestionIndex) {
		this.resetResults(QuestionIndex);
		this.save();
	}
}

PollManager.prototype.save = function() {
	PollResults.insert({
		question: this.getCurrentQuestion(),
		results: this.resultState
	});
}

PollManager.prototype.vote = function(letter) {
	this.update();

	if(letter === "A") {
		this.resultState.A.count = this.resultState.A.count + 1;
		this.save();
	}

	if(letter === "B") {
		this.resultState.B.count = this.resultState.B.count + 1;
		this.save();
	}
}

if (Meteor.isClient) {
	Session.set("donations_total", 0);

	$(document).ready(function() {
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

		function AnimateMessage(text) {
			var position = Math.random() * 800;
			var message = $("<div class='scrolling-message'>"+text.toUpperCase()+"</div>");
			$("body").append(message);
			$(message).css({"position": "absolute", "left": "1500px", "top": position});
			$(message).animate({left: -1 * $(message).width()}, 10000, function() {
				$(this).remove();
			});
		}

		Meteor.autosubscribe(function() {
			Subscribers.find().observe({
				added: function(sub) {
					AddNode(sub.username);
					Session.set("sub_count", Subscribers.find().count());
				}
			});

			Donations.find().observe({
				added: function(donation) {
					Session.set("last_donation", donation);

					var donations_total = parseFloat(Session.get("donations_total"));
					donations_total = donations_total + parseFloat(donation.amount);

					Session.set("donations_total", donations_total.toFixed(2));
				}
			});

			Messages.find().observe({
				added: function(message) {
					AnimateMessage(message.text);
				}
			});

			PollResults.find().observe({
				added: function(results) {
					Session.set("PollState", results);
				}
			});
		});
	});

	Template.body.helpers({
		PollState: function() { return Session.get("PollState") },
		SubCount: function() { return Session.get("sub_count") },
		LastDonation: function() { return Session.get("last_donation") },
		DonationsTotal: function() { return Session.get("donations_total") },
	});
}

if (Meteor.isServer) {

	var pollManager = new PollManager();


  Meteor.startup(function () {
    // code to run on server at startup
	irc = Meteor.npmRequire("irc");

	Messages.remove({});
	Subscribers.remove({});
	PollResults.remove({});

	var client = new irc.Client('irc.twitch.tv', 'agscala', {
		channels: ['#mustseetwitchtv'],
		sasl: true,
		username: "agscala",
		password: "oauth:o3qzmv5do28rocpuey1d5kz0e8goai"
	});

	var callback = Meteor.bindEnvironment(function(from, to, message) {

		Messages.insert({
			username: from,
			text: message
		});

		if(message.toUpperCase().indexOf("SUBSCRIBE") != -1) {
			Subscribers.insert({
				username: from,
				message: message
			});
		}

		var regex = /donate (\d+\.?\d+?) ([\w ]+)/
		var matches = message.match(regex);
		if(matches !== null) {
			Donations.insert({
				username: from,
				amount: matches[1],
				message: matches[2]
			});
		}

		pollManager.update();

		if(message.indexOf("VOTE A") !== -1) { // VOTE A
			pollManager.vote("A");
		}

		if(message.indexOf("VOTE B") !== -1) { // VOTE B
			pollManager.vote("B");
		}
	});

	client.addListener('message', callback);
  });
}


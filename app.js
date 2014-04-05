var express = require('express');
var rest = require('restler');
var GitHubApi = require('github');
var config = require('./config.js');

var app = express();

app.use(express.bodyParser());

function createStatus(repository, revision, results) {
    var github = new GitHubApi({version: '3.0.0',
                                debug: true});

    github.authenticate({type: 'oauth',
                         token: config.githubToken});

    var message = {user: "sugarlabs",
                   repo: repository.split('/')[splitted.length - 1],
                   sha: revision,
                   state: results === 0 ? 'success': 'failure'};

    github.statuses.create(message, function(error, data) {
        console.log("Creating status\n" + JSON.stringify(message));

        if (error) {
            console.log("Error:\n");
            console.log(error);
        } else {
            console.log("Done.");
        }
    });
}

app.post('/status', function (request, response) {
    response.send(200);
    var packets = JSON.parse(request.body.packets);

    for (var i = 0; i < packets.length; i++) {
        var packet = packets[i];

        if (packet.event == 'buildFinished') {
            var sourceStamps = packet.payload.build.sourceStamps;
            for (var k = 0; k < sourceStamps.length; k++) {
                var sourceStamp = sourceStamps[k];
                createStatus(sourceStamp.repository,
                             sourceStamp.revision,
                             packet.payload.results);
            }
        }
    }

    response.send(200);
});

app.post('/change', function (request, response) {
    var payload = JSON.parse(request.body.payload);

    var repository;
    var revision;
    var author;
    var comments;
    var category;

    if ('pull_request' in payload) {
        repository = payload.pull_request.head.repo.html_url;
        revision = payload.pull_request.head.sha;
        author = payload.pull_request.user.login;
        comments = payload.pull_request.title;
        category = "pullrequest";
    } else if ("head_commit" in payload) {
        repository = payload.repository.url;
        revision = payload.head_commit.id;
        author = payload.head_commit.author.name;
        comments = payload.head_commit.message;
        category = "push";
    } else {
        response.send(200);
        return;
    } 

    var options = {data: {project: 'sugar-build',
                          revision: revision,
                          author: author,
                          repository: repository,
                          category: category,
                          comments: comments}};

    rest.post(config.changeHook, options).on('complete',
    function (data, response) {
        console.log("Change posted\n" + data);
    });

    response.send(200);
});

app.listen(3000);

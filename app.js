var express = require('express');
var rest = require('restler');
var GitHubApi = require('github');
var config = require('./config.js');

var app = express();

app.use(express.bodyParser());

function createStatus(repository, revision, state, targetUrl) {
    var github = new GitHubApi({version: '3.0.0',
                                debug: true});

    var splitted = repository.split('/');

    var message = {user: splitted[splitted.length - 2],
                   repo: splitted[splitted.length - 1]};

    github.repos.get(message, function(error, data) {
        splitted = data.parent.html_url.split('/');

        var user = splitted[splitted.length - 2];

        message = {user: user,
                   repo: splitted[splitted.length - 1],
                   sha: revision,
                   state: state};

        github.authenticate({type: 'oauth',
                             token: config.githubTokens[user]});

        if (targetUrl) {
            message.target_url = targetUrl;
        }

        github.statuses.create(message, function(error, data) {
            console.log("Creating status\n" + JSON.stringify(message));

            if (error) {
                console.log("Error:\n");
                console.log(error);
            } else {
                console.log("Done.");
            }
        });
    });
}

app.post('/status', function (request, response) {
    response.send(200);
    var packets = JSON.parse(request.body.packets);

    for (var i = 0; i < packets.length; i++) {
        var packet = packets[i];
        var build = packet.payload.build;

        if (packet.event == 'buildFinished') {
            var sourceStamp = build.sourceStamps[0];

            if (sourceStamp.changes[0].category == 'pullrequest') {
                var buildbotUrl = 'http://buildbot.sugarlabs.org' +
                                  '/builders/try-master/builds/' +
                                  build.properties[3][1];

                createStatus(sourceStamp.repository,
                             sourceStamp.revision,
                             build.results ? 'failure': 'success',
                             buildbotUrl);
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

    var pr = payload.pull_request;
    var action = payload.action;

    if (pr && (action == "opened" ||
               action == "reopened" ||
               action == "synchronize")) {
        repository = pr.head.repo.html_url;
        revision = pr.head.sha;
        author = pr.user.login;
        comments = pr.title + "\n" + pr.url;
        category = "pullrequest";
    } else if (payload.head_commit) {
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
        console.log("Change posted");
    });

    createStatus(repository, revision, 'pending');
 
    response.send(200);
});

app.listen(3000);

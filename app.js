const mysql = require('mysql2');
const express = require('express');
const rateLimit = require("express-rate-limit");
const bodyParser = require('body-parser');

var figlet = require("figlet");
const chalk = require('chalk');

const app = express();

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Camsdono27112006',
  database: 'LogBug'
});

const limiter = rateLimit({
  windowMs: 5000, // 5 seconds
  max: 5, // limit each IP to 10 requests per windowMs
  message: "Too many requests from this IP, please try again in 5 seconds",
});

app.use(limiter);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Welcome To LogBugAPI');
});

app.get('/getusers', limiter, (req, res) => { 
    if (req.query.id === undefined) { 
        res.status(400).send('Missing id parameter');
    } else {
    const id = req.query.id;
    connection.query('SELECT * FROM users WHERE id = ?', [id], (error, results, fields) => {
      if (error) {
        res.status(500).send('Error retrieving user with id ' + id);
      } else if (results.length === 0) {
        res.status(404).send('User with id ' + id + ' not found');
      } else {
        const user = results[0]; 
        const userData = {
          username: user.username,
          email: user.email
        };
        res.json(userData);
      }
    });
    }
});



app.post('/getbug', limiter, (req, res) => {
    if (req.body.id === undefined || req.body.key === undefined) {
        res.status(400).send('Missing id parameter or API Key');
    } else {
    const id = req.body.id;
    const key = req.body.key;

    connection.query('SELECT * FROM bugs WHERE id = ?', [id], (error, results, fields) => {
      if (error) {
        res.status(500).send('Error retrieving bug with id ' + id);
      } else if (results.length === 0) {
        res.status(404).send('Bug with id ' + id + ' not found');
      } else {
        const bug = results[0];

        // get project from projectid 
        connection.query('SELECT * FROM projects WHERE id = ?', [bug.projectID], (error, results, fields) => {
            if (error) {
              res.status(500).send('Error retrieving project with id ' + bug.projectID);
            } else if (results.length === 0) {
              res.status(404).send('Project with id ' + bug.projectID + '  not found');
            } else {
              const project = results[0];
              if (project.apiKey !== key) {
                res.status(401).send('Invalid API Key');
              } else {
                var status = "";
                if (bug.closedBug === 0) {
                    status = 'Open';
                } else if (bug.closedBug === 1) {
                    status = 'Closed';
                }

                var dueDate = "";

                if (bug.dueDate ==0) {
                    dueDate = 'Not Set';
                } else {
                    dueDate = bug.dueDate;
                }
                const bugData = {
                  title: bug.bugName,
                  description: bug.bugDesc,
                  status: status,
                  priority: bug.priority,
                  dueDate: dueDate
                };
                res.json(bugData);
              }
            }
          });        
      }
    });
    }
});

app.post('/createbug', limiter, (req, res) => {
  // Check if required parameters are present
  if (req.body.APIKey === undefined || req.body.bugName === undefined || req.body.bugDesc === undefined || req.body.priority === undefined) {
    res.status(400).send('Missing required parameters');
  } else {
    const projectApiKey = req.body.APIKey;
    const bugName = req.body.bugName;
    const bugDesc = req.body.bugDesc;
    const priority = req.body.priority;

    // Check if API key is valid for project
    connection.query('SELECT * FROM projects WHERE apiKey = ?', [projectApiKey], (error, results, fields) => {
      if (error) {
        res.status(500).send('Error retrieving project with apiKey ' + projectApiKey);
      } else if (results.length === 0) {
        res.status(404).send('Project with apiKey ' + projectApiKey + ' not found');
      } else {
        const project = results[0];
        if (project.apiKey !== projectApiKey) {
          res.status(401).send('Invalid API Key');
        } else {
          // Create new bug entry in database
          const closedBug = 0; // Set initial status to open
          const projectID = project.id;
          connection.query('INSERT INTO bugs (projectID, bugName, bugDesc, priority, closedBug) VALUES (?, ?, ?, ?, ?)', [projectID, bugName, bugDesc, priority, closedBug], (error, results, fields) => {
            if (error) {
              res.status(500).send('Error creating bug');
            } else {
              res.status(201).send('Bug created successfully');
            }
          });
        }
      }
    });
  }
});

app.post('/assignbug',limiter, (req, res) => {
  if (req.body.APIKey === undefined || req.body.bugID === undefined || req.body.userID === undefined) {
    res.status(400).send('Missing required parameters');
  } else {
    APIkey = req.body.APIKey;
    bugID = req.body.bugID;
    userID = req.body.userID;

    connection.query('SELECT * FROM projects WHERE apiKey = ?', [APIkey], (error, results, fields) => {
      if (error) {
        res.status(500).send('Error retrieving project with apiKey ' + req.body.APIKey);
      } else if (results.length === 0) {
        res.status(404).send('Project with API KEY: ' + req.body.APIKey + ' not found');
      } else {
        const project = results[0];
        if (project.apiKey !== APIkey) {
          res.status(401).send('Invalid API Key');
        } else {
         // get bug from bugID and projectID 
          connection.query('SELECT * FROM bugs WHERE id = ? AND projectID = ?', [bugID, project.id], (error, results, fields) => {
            // Check if bug exists
            if (error) {
              res.status(500).send('Error retrieving bug with id ' + bugID);
            } else if (results.length === 0) {
              res.status(404).send('Bug with id ' + bugID + ' not found');
            } else {
              const bug = results[0];
              // Check if user exists
              connection.query('SELECT * FROM users WHERE id = ?', [userID], (error, results, fields) => {
                if (error) {
                  res.status(500).send('Error retrieving user with id ' + userID);
                } else if (results.length === 0) {
                  res.status(404).send('User with id ' + userID + ' not found');
                } else {
                  const user = results[0];
                  // Assign bug to user
                  var bugName = bug.bugName;
                  var username = user.username;
                  var userID = user.id;

                  // check if the user is in a org that is assigned to the project
                  connection.query('SELECT * FROM org_members WHERE memberID = ? AND orgID = ?', [userID, project.orgID], (error, results, fields) => {
                    if (error) {
                      res.status(500).send('Either the user or the org does not exist');
                    } else if (results.length === 0) {
                      res.status(404).send('User is not in the org that is assigned to the project');
                    } else {
                      // check if the user is already assigned to the bug
                      connection.query('SELECT * FROM bug_members WHERE userID = ? AND bugID = ?', [userID, bugID], (error, results, fields) => {
                        if (error) {
                          res.status(500).send('Error retrieving bug with id ' + bugID);
                        } else if (results.length === 0) {
                          connection.query('INSERT INTO bug_members (bugID, bugName, username, userID) VALUES (?, ?, ?, ?)', [bugID, bugName, username, userID], (error, results, fields) => {
                            if (error) {
                              res.status(500).send('Error assigning bug');
                            } else {
                              res.status(201).send('Bug assigned successfully');
                            }
                          });
                        } else {
                          res.status(403).send('User is already assigned to the bug');
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      }
    });
  }
});

app.post('/getallbugs',limiter, (req, res) => {
  //ToDo
});

app.post('/openclosebug',limiter, (req, res) => {
  // ToDO 
});

app.listen(3000, () => {
  figlet("LogBug", function (err, data) {
    if (err) {
      console.log("Something went wrong...");
      console.dir(err);
      return;
    }
    const coloredOutput = chalk.red(data);

    console.log(coloredOutput);
  });
  figlet("Software", function (err, data) {
    if (err) {
      console.log("Something went wrong...");
      console.dir(err);
      return;
    }
    const coloredOutput = chalk.blue(data);

    console.log(coloredOutput);
  });


  setTimeout(function () {

    connection.connect((error) => {
      if (error) {
        console.error('❌ - Error connecting to MySQL database: ' + error.stack);
        return;
      }
      console.log('✅ - Database Connection Made ID: ' + connection.threadId);
    });
    
    connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
      if (error) throw error;
      console.log('✅ - Database Test Success');
    });

    console.log('✅ - Server Test Success Port: 3000');
  }, 1000);
});
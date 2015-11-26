var phantom = require('phantom');
var async = require('async');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var sprintf = require('sprintf-js').sprintf;

var outputDir = 'build';

var extMap = {
    cpp: 'cpp',
    java: 'java',
    python: 'py',
    c: 'c',
    csharp: 'cs',
    javascript: 'js',
    ruby: 'rb'
};

var commentMap = {
    cpp: '//',
    java: '//',
    python: '#',
    c: '//',
    csharp: '//',
    javascript: '//',
    ruby: '#'
};

var romanMap = {
    'ii': 'II',
    'iii': 'III',
    'iv': 'IV',
    'v': 'V',
    'vi': 'VI',
    'vii': 'VII',
    'viii': 'VIII',
    'ix': 'IX'
};

function dummy() {
    return [].slice.call(arguments);
}

function processdata(data, link, cb) {
    if (data) {
        var code = data.code;
        code = code.replace('aceCtrl.init', 'dummy').replace(/\n/g, '');
        var d = eval(code);
        var templates = d[0];
        var id = d[2];
        var name = link.replace('https://leetcode.com/problems/', '').replace('/', '');
        var fileName = 'Q' + sprintf('%03d', id) + '_' + name.split('-').map(function(n) {
            if (romanMap.hasOwnProperty(n)) {
                return romanMap[n];
            }
            return n[0].toUpperCase() + n.substring(1);
        }).join('');
        console.log('id = ' + id);
        console.log('filename = ' + fileName);
        async.eachSeries(d[0], function(lang, done) {
            var ext = extMap[lang.value];
            var commentLead = commentMap[lang.value];
            mkdirp(path.join(__dirname, outputDir, lang.value), function(err) {
                if (!err) {
                    var seenEmptyLine = false;
                    var seenNonEmptyLine = false;
                    var content = data.desc.split('\n').filter(function(line) {
                        if (line.trim().length === 0) {
                            if (!seenNonEmptyLine) {
                                return false;
                            }

                            if (seenEmptyLine) {
                                return false;
                            }

                            seenEmptyLine = true;
                        } else {
                            seenNonEmptyLine = true;
                            seenEmptyLine = false;
                        }
                        return true;
                    }).map(function(line) {
                        return (commentLead + ' ' + line).trim();
                    }).join('\n');
                    content += '\n';
                    content += commentLead + '\n';
                    content += commentLead + ' Link:\n';
                    content += commentLead + '     ' + link + '\n';
                    content += '\n';
                    content += '\n';
                    content += lang.defaultCode.replace(/\r\n/g, '\n');
                    content += '\n';
                    fs.writeFile(path.join(__dirname, outputDir, lang.value, fileName + '.' + ext), content, function() {
                        done();
                    });
                } else {
                    done();
                }
            });
        }, function() {
            console.log('case file created for link: ' + link);
            cb();
        });
    } else {
        console.log('skipped link: ' + link);
        cb();
    }
}

function processlink(link, cb) {
    console.log('opening: ' + link);
    phantom.create(function(ph) {
        ph.createPage(function(problemPage) {
            problemPage.open(link, function(status) {
                console.log(status);
                if (status === 'success') {
                    problemPage.evaluate(function() {
                        if (document.querySelector('.form-signin')) {
                            return null;
                        }
                        var desc = null;
                        var code = null;
                        var metas = document.querySelectorAll('head meta');
                        var i = 0;
                        for (i = 0; i < metas.length; i++) {
                            if (metas[i].getAttribute('name') == 'description') {
                                desc = metas[i].getAttribute('content');
                                break;
                            }
                        }
                        var codeForm = document.querySelector('#ajaxform');
                        if (codeForm) {
                            code = codeForm.getAttribute('ng-init');
                        }
                        return {
                            desc: desc,
                            code: code
                        };
                    }, function(data) {
                        processdata(data, link, function() {
                            ph.exit();
                            cb();
                        });
                    });
                } else {
                    cb();
                }
            });
        });
    });
}

phantom.create(function(ph) {
    ph.createPage(function(page) {
        page.open('https://leetcode.com/problemset/algorithms/', function(status) {
            console.log('status ' + status);
            if (status === 'success') {
                page.evaluate(function() {
                    return document.querySelector('#problemList tbody').innerHTML;
                }, function(tb) {
                    var links = [];
                    var re = /a\s+href="([^"]+)"/g;
                    var match = re.exec(tb);
                    while (match != null) {
                        links.push('https://leetcode.com' + match[1]);
                        match = re.exec(tb);
                    }
                    var processedLinks = [];
                    console.log('number of links: ' + links.length);
                    console.log(links);
                    async.eachLimit(links, 5, function(link, cb) {
                        processlink(link, function() {
                            console.log('done processing link: ' + link);
                            processedLinks.push(link);
                            console.log('processed count: ' + processedLinks.length);
                            if (links.length - processedLinks.length < 20) {
                                console.log(links.filter(function(l) {
                                    return processedLinks.indexOf(l) === -1;
                                }));
                            }
                            cb();
                        });
                    }, function() {
                        console.log('Finally done');
                        ph.exit();
                    });
                });
            }
        });
    });
});;

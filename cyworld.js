var sys = require('system'),
    fs = require('fs'),
    page = require('webpage').create(),
    spawn = require('child_process').spawn,
    url = 'http://www.cyworld.com/cymain/',
    stepIndex = 0;
var waitFor = require("./waitFor.js").waitFor;
var PhotoBackup = require("./PhotoBackup.js").create();

var userId, userPw, userTid;

if (sys.args.length != 3) {
    console.log('id, pw required');
    sys.args.forEach(function(arg,i){
      console.log(i+': '+ arg);
    });
    phantom.exit();
} else {
    userId = sys.args[1];
    userPw = sys.args[2];
}

console.log ('UserId Ok : '+ userId)
fs.makeDirectory('./log');

////////////////////////////////////////////////////////////////////////////////
/* log module */

function printArgs() {
    var i, ilen;
    for (i = 0, ilen = arguments.length; i < ilen; ++i) {
        console.log('    arguments[' + i + '] = ' + JSON.stringify(arguments[i]));
    }
    console.log('');
}

page.onInitialized = function() {
    console.log('page.onInitialized');
    printArgs.apply(this, arguments);
};
page.onLoadStarted = function() {
    console.log('page.onLoadStarted');
    printArgs.apply(this, arguments);
};
page.onLoadFinished = function() {
	console.log('page.onLoadFinished');
	printArgs.apply(this, arguments);
};
page.onUrlChanged = function() {
    console.log('page.onUrlChanged');
    printArgs.apply(this, arguments);
};
page.onNavigationRequested = function() {
    console.log('page.onNavigationRequested');
    printArgs.apply(this, arguments);
};
page.onRepaintRequested = function() {
    console.log('page.onRepaintRequested');
    printArgs.apply(this, arguments);
};

page.onConsoleMessage = function(msg){
    console.log('from page console:' + msg);
};

page.onResourceRequested = function(requestData, networkRequest) {
    return;
    if (requestData['url'] && requestData['url'].indexOf('http://minihp.cyworld.com/pims/board/image/imgbrd_list.asp')==-1) return;
    console.log('Request (#' + requestData.id + '): ' + JSON.stringify(requestData));
};

page.onResourceReceived = function(response) {
    return;
    if (response['url'] && response['url'].indexOf('http://minihp.cyworld.com/pims/board/image/imgbrd_list.asp')==-1) return;
    console.log('Response (#' + response.id + ', stage "' + response.stage + '"): ' + JSON.stringify(response));
};

page.onResourceError = function(resourceError) {
    return;
    sys.stderr.writeLine('= onResourceError()');
    sys.stderr.writeLine('  - unable to load url: ' + resourceError.url);
    sys.stderr.writeLine('  - error code: ' + resourceError.errorCode + ', description: ' + resourceError.errorString );
};
 
page.onError = function(msg, trace) {
    if (msg.indexOf('JS_ImgResize')!=0) return;
    sys.stderr.writeLine('= onError()');
    var msgStack = ['  ERROR: ' + msg];
    if (trace) {
        msgStack.push('  TRACE:');
        trace.forEach(function(t) {
            msgStack.push('    -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
        });
    }
    sys.stderr.writeLine(msgStack.join('\n'));
};


function authenticate() {
	page.open(url, function(status) {
		if (status == 'fail') {
			console.log('FAIL: login page loading')
		} else {
			//success
			var g = page.evaluate(function(userId,userPw) {
				
				jQuery('input[name=ID]').val(userId)
				jQuery('input[name=PASSWD]').val(userPw)
				jQuery('input#btnLOGIN').click();
				return jQuery('input[name=ID]').length;
			},userId,userPw);
			console.log('success login-try cnt: '+ g);
			
            page.render('log/step' + stepIndex++ + '.png');
            
            waitFor(function() {
                return page.evaluate(function() {
                    return window.CFN_cn != undefined && window.CFN_cn.length>0;
                });
            }, function() {
                page.render('log/step' + stepIndex++ + '.png');
                var k = page.evaluate(function() {
                    return { id: window.CFN_cmn, name: CFN_cn };
                });
                console.log('k exists? ' + k.name + ' ', k.id, k.name!=undefined);
                userTid = k.id
                fs.write('result.txt','k exists? ' + k.name + ' '+ k.id+'\n', 'w');
                page.stop()
                getMiniHome(k);
            }, function() {
                console.log('login failed');
            }, 300*1000);

            console.log('cookie : ' + JSON.stringify(page.cookies));
		}
	});

}

function getPhotoFolderList() {
    page.open('http://minihp.cyworld.com/svcs/MiniHp.cy/photoLeft/'+userTid+'?tid='+userTid+'&urlstr=phot&seq=#', function(status) {
        if (status == 'fail') {
            console.log('FAIL: photoleft page loading')
            page.render('log/step' + stepIndex++ + '.png');
            setTimeout(function() {
                getPhotoFolderList();
            },3000)
        } else {
            console.log('STATUS LOG : photoLeft page loaded')
            page.injectJs('./lib/jquery.min.js');
            page.render('log/step' + stepIndex++ + '.png');

            var photoFolderList = page.evaluate(function(userTid) {
                function addPage(l_id) {
                    var DOM = $($.ajax({
                        type: 'GET',
                        url: 'http://minihp.cyworld.com/pims/board/image/imgbrd_list.asp?tid='+userTid+'&board_no='+l_id+'&urlstr=phot&item_seq_main=&action=',
                        async: false,
                        contentType:'text/html; charset=ks_c_5601-1987'
                    }).responseText);
                    var moreThan10 = DOM.find('table[height=28] table td[width=14]').length > 0;
                    if (moreThan10) {
                        return DOM.find('table[height=28] table td[width=14] a').attr('onclick').toString().split('cpage=')[1].split('&')[0];
                    } else {
                        return DOM.find('table[height=28] table td[align=center] a').length;
                    }
                }

                function parseFolder(folderDOM) {
                    var $DOM = $(folderDOM),
                        name = $DOM.text().trim(),
                        isSecret = $DOM.attr('class').indexOf('secret') >-1
                        id = $DOM.find('a').attr('href').split("InframeNavi('")[1].split("'")[0];
                    return { type:'folder', name: escape(name), id:id, secret:isSecret, page: addPage(id) };
                }
                var photoFolderList = [];
                var $folderListDOM = $('#folderList > dd,dt');
                console.log('STATUS LOG : folder info loading start')
                for (var i = 0; i < $folderListDOM.length; i++) { //TODO
                    var $e = $folderListDOM.eq(i),
                        className = $e.attr('class');
                    if ( className=='' || className=='clear') continue; //case for '전체보기' or UI hack
                    if ( className.indexOf('group') > -1 ) { // case for 폴더그룹
                        var groupName = $e.text().trim();
                        
                        i++;
                        $e = $folderListDOM.eq(i);
                        var $subElem = $e.find('li'),
                            folderList = $.map($subElem,parseFolder);
                        photoFolderList.push( {
                            'type':'group',
                            'name':escape(groupName),
                            'folderList':folderList
                        });
                    } else {
                        photoFolderList.push(parseFolder($e.find('li')));
                    }
                }
                console.log('STATUS LOG : folder info loading finish')
                return photoFolderList;
            },userTid);
            page.render('log/step' + stepIndex++ + '.png');
            
            fs.makeDirectory('./photo');
            fs.write('./result/photoFolderList.json',JSON.stringify(photoFolderList),'w+');

            console.log("photoFolderList length ", photoFolderList.length)
            PhotoBackup.run(page, photoFolderList, function() { 
                console.log("done!");
            });
            //isPhotoFinished = true;
            //phantom.exit();
        }
    });
}
//var a = document.createElement('script'); a.src='http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js'; document.body.appendChild(a);

var isPhotoFinished = false,
    isDiaryFinished = false;

function getDiary() {
    page.open('http://minihp.cyworld.com/svcs/Diary.cy/Index/'+userTid+'?tid='+userTid+'&urlstr=diar&seq=', function(status) {
        if (status == 'fail') {
            console.log('FAIL: diary page loading')
            page.render('log/step' + stepIndex++ + '.png');
            console.log('retry in 3 sec')
            
            setTimeout(function() {
                getDiary();
            },3000)
        } else {
            console.log('STATUS LOG : diary page loaded')
            page.injectJs('./lib/jquery.min.js');
            page.render('log/step' + stepIndex++ + '.png');

        }
    });

}

function getBoard() {

}

function getMiniHome(userInfo) {
    getPhotoFolderList();
    // isPhotoFinished = true;
    // waitFor(function() {
    //     return isPhotoFinished;
    // }, function() {
    //     getDiary();
    // }, function() {
    //     console.log('ERROR while photo crawl')
    // }, -1 );

    var userId = userInfo.id,
        name = userInfo.name;

    // diary: http://minihp.cyworld.com/svcs/Diary.cy/Index/27802091?tid=27802091&urlstr=diar&seq=
        /*
            http://minihp.cyworld.com/svcs/Diary.cy/MyDiaryList/27802091?urlstr=diar&tid=27802091&list_type=1&folder_no=0&view_type=sevendays
            글 리스트.
        */

    // 게시판 폴더 리스트 : http://minihp.cyworld.com/svcs/MiniHp.cy/BBSLeft/27802091?tid=27802091&urlstr=visi&seq=
    // 게시판 글 목록 : http://minihp.cyworld.com/pims/board/general/board_list.asp?domain=&tid=27802091&board_no=0&list_type=&urlstr=visi&bd_name=%20Request%20Method:GET
    // 사진첩 폴더 리스트 : http://minihp.cyworld.com/svcs/MiniHp.cy/photoLeft/27802091?tid=27802091&urlstr=phot&seq=#
    // 사진첩 글 목록 : http://minihp.cyworld.com/pims/board/image/imgbrd_list.asp?tid=27802091&board_no=0&urlstr=phot&item_seq_main=&action=

}

authenticate();

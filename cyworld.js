var sys = require('system'),
    fs = require('fs'),
    page = require('webpage').create(),
    spawn = require("child_process").spawn,
    url = "http://www.cyworld.com/cymain/",
    stepIndex = 0;

var userId, userPw, userTid;

if (sys.args.length != 3) {
    console.log("id, pw required");
    sys.args.forEach(function(arg,i){
      console.log(i+": "+ arg);
    });
    phantom.exit();
} else {
    userId = sys.args[1];
    userPw = sys.args[2];
}

console.log ("UserId Ok : "+ userId)
fs.makeDirectory("./log");

////////////////////////////////////////////////////////////////////////////////
/* log module */

function printArgs() {
    var i, ilen;
    for (i = 0, ilen = arguments.length; i < ilen; ++i) {
        console.log("    arguments[" + i + "] = " + JSON.stringify(arguments[i]));
    }
    console.log("");
}

page.onInitialized = function() {
    console.log("page.onInitialized");
    printArgs.apply(this, arguments);
};
page.onLoadStarted = function() {
    console.log("page.onLoadStarted");
    printArgs.apply(this, arguments);
};
page.onLoadFinished = function() {
	console.log("page.onLoadFinished");
	printArgs.apply(this, arguments);
};
page.onUrlChanged = function() {
    console.log("page.onUrlChanged");
    printArgs.apply(this, arguments);
};
page.onNavigationRequested = function() {
    console.log("page.onNavigationRequested");
    printArgs.apply(this, arguments);
};
page.onRepaintRequested = function() {
    console.log("page.onRepaintRequested");
    printArgs.apply(this, arguments);
};

page.onConsoleMessage = function(msg){
    console.log("from page console:" + msg);
};

// page.onResourceReceived = function(response) {
//     console.log('Response (#' + response.id + ', stage "' + response.stage + '"): ' + JSON.stringify(response));
// };

page.onResourceError = function(resourceError) {
    sys.stderr.writeLine('= onResourceError()');
    sys.stderr.writeLine('  - unable to load url: "' + resourceError.url + '"');
    sys.stderr.writeLine('  - error code: ' + resourceError.errorCode + ', description: ' + resourceError.errorString );
};
 
page.onError = function(msg, trace) {
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

////////////////////////////////////////////////////////////////////////////////

/**
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 *
 * modefied by Arkind
 * added onTimeout
 */
function waitFor(testFx, onReady, onTimeout, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 30*1000, //< Default Max Timout is 30s
        infinity = timeOutMillis == -1,
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (infinity || (new Date().getTime() - start < maxtimeOutMillis)) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    console.log("'waitFor()' timeout");
                    if (onTimeout) onTimeout();
                    clearInterval(interval);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 250); //< repeat check every 250ms
};

function authenticate() {
	page.open(url, function(status) {
		if (status == 'fail') {
			console.log("FAIL: login page loading")
		} else {
			//success
			var g = page.evaluate(function(userId,userPw) {
				
				jQuery("input[name=ID]").val(userId)
				jQuery("input[name=PASSWD]").val(userPw)
				jQuery("input#btnLOGIN").click();
				return jQuery("input[name=ID]").length;
			},userId,userPw);
			console.log("success login-try cnt: "+ g);
			
            page.render("log/step" + stepIndex++ + ".png");
            
            waitFor(function() {
                return page.evaluate(function() {
                    return window.CFN_cn != undefined && window.CFN_cn.length>0;
                });
            }, function() {
                page.render("log/step" + stepIndex++ + ".png");
                var k = page.evaluate(function() {
                    return { id: window.CFN_cmn, name: CFN_cn };
                });
                console.log("k exists? " + k.name + " ", k.id, k.name!=undefined);
                userTid = k.id
                fs.write("result.txt","k exists? " + k.name + " "+ k.id+"\n", "w");
                page.stop()
                getMiniHome(k);
            }, function() {
                console.log("login failed");
            }, 300*1000);

            console.log("cookie : " + JSON.stringify(page.cookies));
		}
	});

}

function getPhotoFolderList() {
    page.open("http://minihp.cyworld.com/svcs/MiniHp.cy/photoLeft/"+userTid+"?tid="+userTid+"&urlstr=phot&seq=#", function(status) {
        if (status == 'fail') {
            console.log("FAIL: photoleft page loading")
            page.render("log/step" + stepIndex++ + ".png");
            setTimeout(function() {
                getPhotoFolderList();
            },3000)
        } else {
            console.log("STATUS LOG : photoLeft page loaded")
            page.injectJs("./lib/jquery.min.js");
            page.render("log/step" + stepIndex++ + ".png");

            var photoFolderList = page.evaluate(function(userTid) {
                function addPage(l_id) {
                    var DOM = $($.ajax({
                        type: "GET",
                        url: "http://minihp.cyworld.com/pims/board/image/imgbrd_list.asp?tid="+userTid+"&board_no="+l_id+"&urlstr=phot&item_seq_main=&action=",
                        async: false,
                        contentType:"text/html; charset=ks_c_5601-1987"
                    }).responseText);
                    var moreThan10 = DOM.find("table[height=28] table td[width=14]").length > 0;
                    if (moreThan10) {
                        return DOM.find("table[height=28] table td[width=14] a").attr("onclick").toString().split("cpage=")[1].split("&")[0];
                    } else {
                        return DOM.find("table[height=28] table td[align=center] a").length;
                    }
                }

                function parseFolder(folderDOM) {
                    var $DOM = $(folderDOM),
                        name = $DOM.text().trim(),
                        isSecret = $DOM.attr("class").indexOf("secret") >-1
                        id = $DOM.find("a").attr("href").split("InframeNavi('")[1].split("'")[0];
                    return { type:"folder", name: escape(name), id:id, secret:isSecret, page: addPage(id) };
                }
                var photoFolderList = [];
                var $folderListDOM = $("#folderList > dd,dt");
                console.log("STATUS LOG : folder info loading start")
                for (var i = 0; i < $folderListDOM.length; i++) {
                    var $e = $folderListDOM.eq(i),
                        className = $e.attr("class");
                    if ( className=="" || className=="clear") continue; //case for "전체보기" or UI hack
                    if ( className.indexOf("group") > -1 ) { // case for 폴더그룹
                        var groupName = $e.text().trim();
                        
                        i++;
                        $e = $folderListDOM.eq(i);
                        var $subElem = $e.find("li"),
                            folderList = $.map($subElem,parseFolder);
                        photoFolderList.push( {
                            "type":"group",
                            "name":escape(groupName),
                            "folderList":folderList
                        });
                    } else {
                        photoFolderList.push(parseFolder($e.find("li")));
                    }
                }
                console.log("STATUS LOG : folder info loading finish")
                return photoFolderList;
            },userTid);
            page.render("log/step" + stepIndex++ + ".png");
            
            fs.makeDirectory("./photo");
            var startTrue = true,
                target_id = 1,
                page_id = 1;

            for (var i=0;i<photoFolderList.length;i++) {
                if (photoFolderList[i].type=="group") {
                    for (var j=0;j<photoFolderList[i].folderList.length;j++) {
                        var folder = photoFolderList[i].folderList[j];
                        if (folder.id==target_id) {
                            startTrue = true;
                        } 
                        if (startTrue) 
                            getFolderContent(folder);
                    }
                } else {
                    var folder = photoFolderList[i];
                    if (folder.id==target_id) {
                        startTrue = true;
                    } 
                    if (startTrue) 
                        getFolderContent(folder);
                }
            }

            function getFolderContent(folder) {                
                fs.makeDirectory("./photo/"+folder.id);
                var contentList = [];
                var page_start =1;
                if (folder.id == target_id) {
                    page_start = page_id;
                }
                for (var page_i = page_start ; page_i <= folder.page;page_i++) {
                    console.log(JSON.stringify(folder));
                    console.log("folder id:", folder.id, "page:", page_i)
                    var minihp_url = "http://minihp.cyworld.com/pims/board/image/imgbrd_list.asp?tid="+userTid+"&board_no="+folder.id+"&search_content=&search_type=&search_keyword=&cpage="+page_i,
                        pageResult = page.evaluate(function(url) {
                            var k = $.ajax({
                                type: "GET",
                                url: url,
                                async: false,
                                contentType:"text/html; charset=ks_c_5601-1987"
                            }).responseText;

                            try {
                                var DOM = $(k.match(/<body.+>([\r\n]|.)+<\/body>/)[0]),
                                    titleDOM = DOM.find("span.title-text-wrap"),
                                    titleList = titleDOM.map(function(idx,e) { return e.innerHTML.trim() }),
                                    timeDOM = titleDOM.parent().parent().next().next(),
                                    timeList = timeDOM.find(".num:first").map(function(idx,e) { return e.innerHTML; }),
                                    contentDOM = timeDOM.next().next().find("table .text-screen"),
                                    contentList = contentDOM.map(function(idx,e){ return e.innerHTML.split("<style>P {MARGIN-TOP:2px; MARGIN-BOTTOM:2px}</style>").join('').trim(); }),
                                    scrapList = DOM.find("input[id^=isScrap_]").map(function( idx, elem) { 
                                        if ($(elem).val()=="True")
                                        {
                                            var aElem= $(elem).parent().find("a:first")
                                            var hrefAttr = aElem.attr("href");
                                            var textAttr = aElem.text().trim();
                                            if ( /javascript/.test(hrefAttr) ) {
                                                hrefAttr = hrefAttr.match(/\('(.+)'\)/)[1]
                                            }
                                            
                                            return { url:hrefAttr, name:textAttr}
                                        } else { return "";}
                                    }),
                                    replyList = DOM.find(".minihompy-comment tbody").map(function(idx,elem) {
                                        var _t = $(elem).find("tr td")
                                        var _result = []
                                        for (var i = 0;i<_t.length-1;i++) {
                                            var $reply = $(_t[i]),
                                              name = $reply.find(".sname01");
                                              content = $reply.find(".comment-cont")

                                            _result.push({ url:name.attr("href").match(/\('([^']+)'/)[1],
                                                  name:name.text(),
                                                  date:content.find(".date").text(),
                                                  content:content.find("span:first").text(),
                                                  isReply:$reply.hasClass("reply")
                                                  })
                                        }
                                        
                                        return [_result];
                                    }),
                                    result = [];
                                
                                var imgURLList = DOM.find("img[name^=img_], object[name^=img_]>embed").eq(0).map(function(idx,e) { return e.src }),
                                    regexp =/target\_img\.src= \"(.+)\"/g,
                                    match = regexp.exec(k),
                                    firstSWF = k.match(/obj_swfphoto\('([^']+)'/); // if first photo is swf.

                                if ( firstSWF && firstSWF.length >1 ) {
                                    imgURLList = [firstSWF[1]]
                                }
                                while (match != null ) {
                                    imgURLList.push(match[1])
                                    match = regexp.exec(k);
                                }

                                for (var i = 0 ; i < titleList.length; i ++) {
                                    result[i] = { 
                                        title:titleList[i],
                                        time:timeList[i],
                                        imgURL:imgURLList[i],
                                        content:contentList[i],
                                        scrap:scrapList[i],
                                        replies:replyList[i]
                                    }
                                }

                            } catch( e) {
                                console.log("\terror while parsing "+ e.message)
                                console.log(k);
                                return [];
                            }
                            
                            return result;
                        }, minihp_url);
                        
                    console.log("folder id:", folder.id, "page:", page_i, "loaded")
                    console.log("page result : ", pageResult.length);

                    for (var result_i=0;result_i<pageResult.length;result_i++) {
                        console.log(pageResult[result_i].imgURL);
                        console.log("./photo/"+folder.id+"/"+( ((page_i-1)*4) +result_i)+"_"+pageResult[result_i].imgURL.replace(/%2E/g,".").split("%2F").splice(-1)[0])
                        var child = spawn("wget", ["-O", "./photo/"+folder.id+"/"+( ((page_i-1)*4) +result_i)+"_"+pageResult[result_i].imgURL.replace(/%2E/g,".").split("%2F").splice(-1)[0],
                            '--header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8\\r\\n',
                            '--header', 'User-Agent: Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.102 Safari/537.36\\r\\n',
                            '--header', 'Cookie: MAIN=arrActiveEffect=&login%5Fdirection=&GIFT=&REPL=&mem%5FivtCnfm=0&OpenSession=0&FILE%5FReferer=True&onedegrees%5Fcnt=0&logincount=&rkey=\\r\\n',
                            pageResult[result_i].imgURL])
                    }

                    //[].push.apply(contentList, pageResult);
                    var resultJSON = JSON.stringify(pageResult);
                    fs.write("./photo/"+folder.id+"/"+folder.id+"_info.json",resultJSON.substr(1,resultJSON.length-2)+",\n","w+");
                    // contentList에 append 하는 대신 결과파일에 append 하는 식으로 변경이 필요한 구조.
                }

                //fs.write("./photo/"+folder.id+"/"+folder.id+"_info.json",JSON.stringify(contentList),"w");
            }

            fs.write("./result/photoFolderList.json",JSON.stringify(photoFolderList),"w+");
            isPhotoFinished = true;
            //phantom.exit();
        }
    });
}
//var a = document.createElement("script"); a.src="http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"; document.body.appendChild(a);

var isPhotoFinished = false,
    isDiaryFinished = false;

function getDiary() {
    page.open("http://minihp.cyworld.com/svcs/Diary.cy/Index/"+userTid+"?tid="+userTid+"&urlstr=diar&seq=", function(status) {
        if (status == 'fail') {
            console.log("FAIL: diary page loading")
            page.render("log/step" + stepIndex++ + ".png");
            console.log("retry in 3 sec")
            
            setTimeout(function() {
                getDiary();
            },3000)
        } else {
            console.log("STATUS LOG : diary page loaded")
            page.injectJs("./lib/jquery.min.js");
            page.render("log/step" + stepIndex++ + ".png");

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
    //     console.log("ERROR while photo crawl")
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
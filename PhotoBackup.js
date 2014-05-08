exports.create = function () {
  return Module;
};

var Module = {};
var startTrue = true,
    target_id = 1,
    page_id = 1;

Module.run = function(page, photoFolderList, callback) {
    page.evaluate(PhotoPageWorker);

    for (var i=0;i<photoFolderList.length;i++) {
        if (photoFolderList[i].type=="group") {
            for (var j=0;j<photoFolderList[i].folderList.length;j++) {
                var folder = photoFolderList[i].folderList[j];
                checkTargetAndStart(folder);
            }
        } else {
            var folder = photoFolderList[i];
            checkTargetAndStart(folder);
        }
    }
}

function checkTargetAndStart(folder) {
    if (folder.id==target_id) {
        startTrue = true;
    } 
    if (startTrue) 
        getFolderContent(folder);
}


function getFolderContent(folder) {                
    fs.makeDirectory("./photo/"+folder.id);
    var contentList = [];
    var page_start =1;
    if (folder.id == target_id) {
        page_start = page_id;
    }
    folder.page = 5;
    for (var page_i = page_start ; page_i <= folder.page;page_i++) {
        console.log("folder id:", folder.id, "page:", page_i)

        var contentLoaded = false,
            pageResult = [],
            minihp_url = "http://minihp.cyworld.com/pims/board/image/imgbrd_list.asp?tid="+userTid+"&board_no="+folder.id+"&search_content=&search_type=&search_keyword=&cpage="+page_i;

        // q와 worker를 동작시키고 parseHTML
        page.evaluate(function(urlHolder) { 
            console.log("window.Q :", window.Q.length)
            window.Q.push(urlHolder);
        },{ url: minihp_url,
            folder_id: folder.id,
            page: page_i });
    }

    waitFor(function() {
        console.log("waiting", folder.id);
        for (var page_i = page_start ; page_i <= folder.page;page_i++) {
            var notLoaded = page.evaluate(function(key) {
            //    console.log("STORE", window.counter);
                return window.STORE[key] == undefined;
            }, (folder.id+'_'+page_i));
            //console.log("notLoaded", notLoaded);
            if (notLoaded) return false;
        }
        return true;
    }, function () { 
        console.log("waiting complete", folder.id);
        //return false;
        for (var page_i = page_start ; page_i <= folder.page;page_i++) {
            console.log("page_i iteration", page_i);
            var pageResult = page.evaluate(function(key) {
                function parseResult(rawHTML) {
                    console.log("parseResult!!!!!!!!!!!!")
                    var result = ['error'];
                    try {
                        var DOM = $(rawHTML.match(/<body.+>([\r\n]|.)+<\/body>/)[0]),
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
                            match = regexp.exec(rawHTML),
                            firstSWF = rawHTML.match(/obj_swfphoto\('([^']+)'/); // if first photo is swf.

                        if ( firstSWF && firstSWF.length >1 ) {
                            imgURLList = [firstSWF[1]]
                        }
                        while (match != null ) {
                            imgURLList.push(match[1])
                            match = regexp.exec(rawHTML);
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
                        return [];
                    }

                    return result;
                }
                console.log("parseResult??");
                console.log("my key", key);
                for (var k in window.STORE) {
                    console.log(k);
                }
                return parseResult(window.STORE[key]);
            }, (folder.id+'_'+page_i));
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
    }, undefined, -1);
    

    /* sample
        page.evaluate(function(url) { 
            var request = $.ajax({
                type: "GET",
                url: url,
                success: function(data) {
                    window.loadedData = data;
                },
                contentType:"text/html; charset=ks_c_5601-1987"
            });
        },minihp_url);
        waitFor(function() {
            return page.evaluate(function () {
                return window.loadedData;
            }) != undefined;
        }, function () {
            .loadedData;
            }).substr(10,10))console.log("data loaded" + page.evaluate(function () {
                return window
        }, undefined, 30*1000)
*/  
}

var PhotoPageWorker = function() {
    window.Q = [];
    window.STORE = {};
    window.counter = 0;
    setInterval(function () {
        var nextURL_holder = window.Q.shift();
        if ( nextURL_holder ) {
            loadURL(nextURL_holder);
        }
        window.counter += 1;
    },500);

    function loadURL(URL_holder) {
        $.ajax({
            type: "GET",
            url: URL_holder.url,
            success: function(data) {
                var key = URL_holder.folder_id+"_"+URL_holder.page;
                window.STORE[key] = data;
            },
            error: function() { 
                loadURL(URL_holder);
            },
            contentType:"text/html; charset=ks_c_5601-1987"
        });
    }
}

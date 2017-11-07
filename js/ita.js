var loglevel = 1;
var DataBuff;
var size = {};

function readBlob(start, length, callback, args){
   var file = itafile.files[0];
   var b = file.slice(start, start+length);
   var reader = new FileReader();
   reader.readAsBinaryString(b);
   reader.onloadend = function(evt){
       callback(evt.target.result, start, args);
   };
}

function parseHeader(x, start, args) {
    var A = new ArrayBuffer(25);
    var D = new DataView(A);
    for(var i=0;i<25;i++) D.setUint8(i,x.charCodeAt(i));
    var length = D.getUint32(5, true);
    var z = D.getUint32(9, true);
    var u = D.getUint32(13, true);
    var x = D.getUint32(17, true);
    var y = D.getUint32(21, true);
    readBlob(start,25+length+x, parseBlock, args)
}

function parseBlock(raw, start, args){
    var A = new ArrayBuffer(raw.length);
    var D = new DataView(A);
    for(var i=0;i<raw.length;i++) D.setUint8(i,raw.charCodeAt(i));
    var length = D.getUint32(5, true);
    var z = D.getUint32(9, true);
    var u = D.getUint32(13, true);
    var x = D.getUint32(17, true);
    var y = D.getUint32(21, true);
    var name = raw.substr(25,length);
    if(loglevel>1) console.log("Reading block", name);
    args.block = {name: name};
    if(args.path.length == 0) args.dataCallback(A, args);
    else args.callback(A, args);
}

function getChildren(start, args){
    args.callback = parseChildren;
    readBlock(start, args);
}

function parseChildren(buff, args){
    var D = new DataView(buff);
    var type = D.getUint8(0, true);
    var NameLength = D.getUint32(5, true);
    var Name = "";
    for(var i=0;i<NameLength;i++) Name+=String.fromCharCode(D.getUint8(25+i));
    var u = D.getUint32(13, true);
    var offset = 25+NameLength
    var length = D.getUint32(offset, true);
    var nums = D.getUint32(4+offset, true);
    var type = D.getUint8(8+offset, true);
    var NextBlock = (D.getUint32(37+offset, true) << 32)| D.getUint32(33+offset, true);
    var targetName = args.path.split('/')[0];
    var targetIndex = targetName.match(/([^\[]*]*)(?:\[([0-9]+)\])?/)[2];
    if(targetIndex == undefined) targetIndex = 0;
    targetName = targetName.match(/([^\[]*]*)(?:\[([0-9]+)\])?/)[1];
    for(var i=0;i<(u==0?nums:u);i++){
        var index = D.getUint32(33*i+42+offset, true);
        var slen =  D.getUint32(33*i+46+offset, true);
        var id   =  D.getUint32(33*i+50+offset, true);
        var blen =  D.getUint32(33*i+58+offset, true);
        var bidx =  D.getUint32(33*i+66+offset, true);
        var sname = "";
        for(var j=0;j<slen;j++) {
            sname += String.fromCharCode(D.getUint8(25+NameLength+index+j));
        }
        if(sname == targetName && id==targetIndex){
            if(loglevel>1) console.log("Child", sname, "Found");
            args.path = args.path.split('/').slice(1).join('/')
            getChildren(bidx,args);
        }        
    }
    if(NextBlock) {
        getChildren(NextBlock, args);
    }
}

function setPeakName(buff, args){
    var D = new DataView(buff);
    var slen = D.getUint32(5, true);
    var x = D.getUint32(17, true);
    var A = new Uint8Array(buff,25+slen);
    var name = "";
    for(var i=0;i<x;i+=2){
        var code = (A[i+1]<<8)|A[i];
        name += String.fromCharCode(code);
    }
    if(name==''){
        getData('MassIntervalList/mi['+args.id+']/desc', setPeakName, args);
    }else{
        $('#channels option[value="'+args.id+'"').text(name);
    }
}

function setPeakId(buff, args){
    while($('#channels option[value="'+args.id+'"').length==0){
        console.log("Option not ready... waiting...");
    }
    var D = new DataView(buff);
    var slen = D.getUint32(5, true);
    var ID = D.getUint32(25+slen, true);
    $('#channels option[value="'+args.id+'"').attr("data-ID", ID);
}
    
function getPeakList(buff, args){
    var D = new DataView(buff);
    var type = D.getUint8(0, true);
    var NameLength = D.getUint32(5, true);
    var Name = "";
    for(var i=0;i<NameLength;i++) Name+=String.fromCharCode(D.getUint8(25+i));
    var u = D.getUint32(13, true);
    var offset = 25+NameLength
    var length = D.getUint32(offset, true);
    var nums = D.getUint32(4+offset, true);
    var type = D.getUint8(8+offset, true);
    var NextBlock = (D.getUint32(37+offset, true) << 32)| D.getUint32(33+offset, true);
    for(var i=0;i<(u==0?nums:u);i++){
        var index = D.getUint32(33*i+42+offset, true);
        var slen =  D.getUint32(33*i+46+offset, true);
        var id   =  D.getUint32(33*i+50+offset, true);
        var blen =  D.getUint32(33*i+58+offset, true);
        var bidx =  D.getUint32(33*i+66+offset, true);
        var sname = "";
        var first = -1;
        for(var j=0;j<slen;j++) {
            sname += String.fromCharCode(D.getUint8(25+NameLength+index+j));
        }
        
        if(sname == 'mi'){
            if(first<0) first = id;
            $('#channels').append($('<option>',{value:id,text:"Loading..."}));
            var args2 = Object.assign({}, args);
            args2.id = id;
            var args3 = Object.assign({}, args2);
            getData('MassIntervalList/mi['+id+']/assign', setPeakName, args2);
            getData('MassIntervalList/mi['+id+']/id', setPeakId, args3);
        }
    }
    if(NextBlock) {
        getChildren(NextBlock, args);
    }else{
        readImage();
    }   
}

function readBlock(start, args) {
   readBlob(start, 25, parseHeader, args);
}

function getData(path, callback, args){
    if(args == undefined){ var args={}; }
    args.path = path;
    args.dataCallback = callback;
    getChildren(8,args)
}

function parseData(buff, args){
    var D = new DataView(buff);
    var slen = D.getUint32(5, true);
    var x = D.getUint32(17, true);
    var raw = new Uint8Array(buff, 25+slen, x)
    var data = pako.inflate(raw);
    var Ddata = new DataView(data.buffer);
    DataBuff = data.buffer.slice(0);
    size.x = args.x;
    size.y = args.y;
    var dmin = Ddata.getUint32(0, true);
    var dmax = Ddata.getUint32(0, true);
    var N = size.x*size.y;
    for(var i=0; i<N; i++){
        var val = Ddata.getUint32(4*i, true);
        if(val < dmin) dmin = val;
        if(val > dmax) dmax = val;
    }
     $('#slider-range').slider({
        range: true,
        min: 0,
        max: dmax,
        values: [0,dmax],
        stop: function( event, ui ) {
            $('#minmax').val(ui.values[0]+' - ' +ui.values[1]);
            plotData();
        }
    });
    $( "#minmax" ).val( $( "#slider-range" ).slider( "values", 0 ) +
      " - " + $( "#slider-range" ).slider( "values", 1 ) )
   
    plotData();
}
function plotData(){
    var Ddata = new DataView(DataBuff);
    var scaling = $("#options").find("h3[aria-expanded=true]").attr('id');
    if(scaling == 'auto'){
        var dmin = Ddata.getUint32(0, true);
        var dmax = Ddata.getUint32(0, true);
        var s = 0;
        var s2 = 0;
        var N = size.x*size.y;
        for(var i=0; i<N; i++){
            var val = Ddata.getUint32(4*i, true);
            s += val;
            s2 += val*val;
            if(val < dmin) dmin = val;
            if(val > dmax) dmax = val;
        }console.log("Plot auto scaling",dmin,dmax);
    }else{
        var dmin = $( "#slider-range" ).slider( "values", 0 );
        var dmax = $( "#slider-range" ).slider( "values", 1 );
        console.log("Plot manual scaling",dmin,dmax);
    }
    var c = $('#canvas')[0];
    c.width = size.x;
    c.height = size.y;
    var ctx = c.getContext("2d");
    var myImageData = ctx.createImageData(size.x, size.y);
    for(var y=0; y<size.y; y++){
        for(var x=0; x<size.x; x++){
            var value = Ddata.getUint32(4*(size.x*y+x), true)
            var norm = (value-dmin)/(dmax-dmin);
            var colormap = $('#colormap').find(':selected').val();
            var rgb;
            if(colormap=='hot'){
                rgb = hot(norm);
            }else if(colormap=='gray'){
                rgb = gray(norm);
            }else if(colormap=='viridis'){
                rgb = viridis(norm);
            }
            for(var i=0; i<3; i++){
                myImageData.data[(y*size.x+x)*4+i] = Math.round(255*rgb[i]);
            }
            myImageData.data[(y*size.x+x)*4+3] = 255;
        
        }
    }
    ctx.putImageData(myImageData, 0, 0);
}

function readITA(){
    $('#channels').find('option').remove();
    getChildren(8,{path:'MassIntervalList',dataCallback:getPeakList})
}

function readImage(){
        if(itafile.files.length>0){
            var id = $('#channels').find(":selected").attr('data-id');
            console.log("Reading image ID",id);
            readITAimage(undefined,{id:id})
        }
}

function readITAimage(buff, info) {
    if(buff != undefined){
        var D = new DataView(buff);
        var slen = D.getUint32(5, true);
    }
    if(info.x == undefined){
        if(buff == undefined){
            getData('filterdata/TofCorrection/ImageStack/Reduced Data/ImageStackScans/Image.XSize', readITAimage, info);
        }else{
            info.x = D.getUint32(25+slen, true);
            getData('filterdata/TofCorrection/ImageStack/Reduced Data/ImageStackScans/Image.XSize', readITAimage, info);
        }
    }else if(info.y == undefined){
        info.y = D.getUint32(25+slen, true);
        getData('filterdata/TofCorrection/ImageStack/Reduced Data/ImageStackScansAdded/Image['+info.id+']/ImageArray.Long', parseData, info);
    }
}


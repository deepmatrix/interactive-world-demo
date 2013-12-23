THREE.DynamicTerrainMap=function(parameters){this._scene=parameters.scene?parameters.scene:null;this._camera=parameters.camera?parameters.camera:null;this._material=parameters.material?parameters.material:null;this._debugMode=parameters.debugMode?true:false;this._position=parameters.position?parameters.position:{x:0,y:0,z:0};this._mapChunkSize=parameters.mapChunkSize?parameters.mapChunkSize:500;this._detailRanges=parameters.detailRanges?parameters.detailRanges:[100,1500,3000,10000];this._chunkHoverRange=parameters.chunkHoverRange?parameters.chunkHoverRange:500;this._chunkShowFarthest=parameters.chunkShowFarthest?parameters.chunkShowFarthest:false;this._convertToRgba=parameters.convertToRgba?parameters.convertToRgba:function(value){value=parseInt(1000*(parseFloat(value).toFixed(3)));var a=value&255;value=value>>>8;var b=value&255;value=value>>>8;var g=value&255;value=value>>>8;var r=value&255;value=value>>>8;return{r:r,g:g,b:b,a:a};};this._convertToFloat=parameters.convertToFloat?parameters.convertToFloat:function(rgba){var value=0>>>32;value+=rgba.r;value=value<<8;value+=rgba.g;value=value<<8;value+=rgba.b;value=value<<8;value+=rgba.a;return value/1000;};if(typeof parameters.useWorkers=="undefined"){this._useWorkers=(typeof Worker=="undefined")?false:true;}else{this._useWorkers=parameters.useWorkers?true:false;}this._workerScriptLocation=parameters.workerScriptLocation?parameters.workerScriptLocation:"DynamicTerrainMapChunkWorker.js";this._cameraLastPosition=this._camera.position;this._width=null;this._depth=null;this._map=null;this._heightMap=null;this._heightMapLength=0;this._chunkBuilder=null;};THREE.DynamicTerrainMap._debugModeColors=[4276545,34816,3368601,16728320,231836,10920960,12529712];THREE.DynamicTerrainMap.lerp=function(v1,v2,f){return v1+(v2-v1)*f;};THREE.DynamicTerrainMap.prototype.init=function(parameters,mainCallback){if(this._width!=null||this._depth!=null){return;}if(this._scene==null||this._camera==null){return;}if(parameters.data&&parameters.width&&parameters.depth){this._createArrayHeightMap(parameters.data,parameters.width,parameters.depth,mainCallback);}else{if(parameters.imageUrl){this._loadImageHeightMap(parameters.imageUrl,mainCallback);}else{parameters.width=parameters.width?parameters.width:1000;parameters.depth=parameters.depth?parameters.depth:parameters.width;this._createFlatHeightMap(parameters.width,parameters.depth,mainCallback);}}};THREE.DynamicTerrainMap.prototype.width=function(){return this._width;};THREE.DynamicTerrainMap.prototype.depth=function(){return this._depth;};THREE.DynamicTerrainMap.prototype.position=function(){return this._position;};THREE.DynamicTerrainMap.prototype.heightAt=function(x,z){x=Math.round(x*100)/100;z=Math.round(z*100)/100;if(x<0||x>this._width||z<0||z>this._depth){return undefined;}if(Math.round(x)==x&&Math.round(z)==z&&this._heightMap[this._getHeightMapArrayPosition(x,z)]){return this._heightMap[this._getHeightMapArrayPosition(x,z)];}var nw={x:Math.floor(x),z:Math.floor(z)};var ne={x:Math.ceil(x),z:Math.floor(z)};var sw={x:Math.floor(x),z:Math.ceil(z)};var se={x:Math.ceil(x),z:Math.ceil(z)};nw.y=this._heightMap[this._getHeightMapArrayPosition(nw.x,nw.z)];ne.y=this._heightMap[this._getHeightMapArrayPosition(ne.x,ne.z)];sw.y=this._heightMap[this._getHeightMapArrayPosition(sw.x,sw.z)];se.y=this._heightMap[this._getHeightMapArrayPosition(se.x,se.z)];var dx=(x-Math.floor(x));var dz=(z-Math.floor(z));return THREE.DynamicTerrainMap.lerp(THREE.DynamicTerrainMap.lerp(nw.y,se.y,((1+dx-dz)/2)),(dx>(1-dz))?ne.y:sw.y,Math.abs(1-dx-dz));};THREE.DynamicTerrainMap.prototype.checkGeometry=function(){for(var i=0;i<this._map.length;i++){this._map[i].checkGeometry();}};THREE.DynamicTerrainMap.prototype._loadImageHeightMap=function(imageUrl,callback){var _this=this;var heightMapImage=new Image;heightMapImage.onload=(function(){_this._width=heightMapImage.width;_this._depth=heightMapImage.height;_this._heightMapLength=_this._width*_this._depth;_this._heightMap=new Float32Array(_this._heightMapLength);var heightMapImageDataCanvas=document.createElement("canvas");heightMapImageDataCanvas.width=_this._width;heightMapImageDataCanvas.height=_this._depth;var heightMapImageDataContext=heightMapImageDataCanvas.getContext("2d");heightMapImageDataContext.drawImage(heightMapImage,0,0);var heightMapImageData=heightMapImageDataContext.getImageData(0,0,_this._width,_this._depth);var r,g,b,a;for(var i=0;i<heightMapImageData.data.length;i+=4){_this._heightMap[i/4]=_this._convertToFloat({r:heightMapImageData.data[i+0],g:heightMapImageData.data[i+1],b:heightMapImageData.data[i+2],a:heightMapImageData.data[i+3]});}_this._generateMap(callback);});heightMapImage.src=imageUrl;};THREE.DynamicTerrainMap.prototype._createFlatHeightMap=function(width,depth,callback){this._width=width;this._depth=depth;this._heightMapLength=this._width*this._depth;this._heightMap=new Float32Array(this._heightMapLength);for(var i=0;i<this._heightMapLength;i++){this._heightMap[i]=0;}this._generateMap(callback);};THREE.DynamicTerrainMap.prototype._createArrayHeightMap=function(data,width,depth,callback){this._width=width;this._depth=depth;this._heightMapLength=this._width*this._depth;if(data.length!=(width*depth)){for(var i=data.length;i<this._heightMapLength;i++){data[i]=0;}}this._heightMap=data;this._generateMap(callback);};THREE.DynamicTerrainMap.prototype._generateMap=function(callback){var _this=this;this._map=[];if(this._useWorkers){_this._chunkBuilder=new THREE.DynamicTerrainMapChunkBuilder();_this._chunkBuilder.init({workerCount:2,workerScriptLocation:this._workerScriptLocation,width:this._width,depth:this._depth,heightMap:this._heightMap,heightMapLength:this._heightMapLength,sendChunkGeometry:function(index,distanceIndex,xVertices,zVertices,xOffset,zOffset,bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets){_this._sendChunkGeometry(index,distanceIndex,xVertices,zVertices,xOffset,zOffset,bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);}});}var widthStart=this._position.x-Math.floor(this._width/2)+(this._mapChunkSize/2);var depthStart=this._position.z-Math.floor(this._depth/2)+(this._mapChunkSize/2);for(var j=0;j<Math.ceil(this._width/this._mapChunkSize);j++){for(var k=0;k<Math.ceil(this._depth/this._mapChunkSize);k++){var mapChunkMaterial=this._material;if(this._debugMode){var genericWireframeMaterial=new THREE.GenericWireframeMaterial({repeat:10,width:0.005,color:new THREE.Color(THREE.DynamicTerrainMap._debugModeColors[Math.floor(Math.random()*THREE.DynamicTerrainMap._debugModeColors.length)])});mapChunkMaterial=genericWireframeMaterial.generateMaterial();}var mapChunkIndex=parseInt(j+k*Math.ceil(this._width/this._mapChunkSize));var mapChunkWidth=(j*this._mapChunkSize+this._mapChunkSize>this._width)?(this._width-j*this._mapChunkSize):this._mapChunkSize;var mapChunkDepth=(k*this._mapChunkSize+this._mapChunkSize>this._depth)?(this._depth-k*this._mapChunkSize):this._mapChunkSize;var mapChunk=new THREE.DynamicTerrainMapChunk({mapIndex:mapChunkIndex,width:mapChunkWidth,depth:mapChunkDepth,position:{x:(widthStart+j*this._mapChunkSize-((this._mapChunkSize-mapChunkWidth)/2)),y:this._position.y,z:(depthStart+k*this._mapChunkSize-((this._mapChunkSize-mapChunkDepth)/2))},detailRanges:this._detailRanges,chunkHoverRange:this._chunkHoverRange,chunkShowFarthest:this._chunkShowFarthest,heightMap:this._heightMap,heightMapLength:this._heightMapLength,heightMapWidth:this._width,heightMapDepth:this._depth,heightMapWidthZero:(j*this._mapChunkSize),heightMapDepthZero:(k*this._mapChunkSize),material:mapChunkMaterial,camera:this._camera,scene:this._scene,useWorkers:this._useWorkers,buildChunkGeometry:!this._useWorkers?null:function(chunkIndex,distanceIndex,widthZero,depthZero,chunkWidth,chunkDepth){_this._chunkBuilder.updateChunkGeometry({mapChunkIndex:chunkIndex,distanceIndex:distanceIndex,heightMapWidthZero:widthZero,heightMapDepthZero:depthZero,chunkWidth:chunkWidth,chunkDepth:chunkDepth});}});this._map[mapChunkIndex]=mapChunk;}}if(callback){callback();}};THREE.DynamicTerrainMap.prototype._sendChunkGeometry=function(index,distanceIndex,xVertices,zVertices,xOffset,zOffset,bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets){this._map[index].updateChunkGeometry(distanceIndex,xVertices,zVertices,xOffset,zOffset,bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);};THREE.DynamicTerrainMap.prototype._getHeightMapArrayPosition=function(widthPosition,depthPosition){return(depthPosition*this._width+widthPosition);};THREE.DynamicTerrainMap.prototype._getMapArrayPosition=function(widthPosition,depthPosition){return((Math.floor(this._width/this._mapChunkSize)*Math.floor(depthPosition/this._mapChunkSize))+Math.floor(widthPosition/this._mapChunkSize));};THREE.DynamicTerrainMapChunk=function(parameters){this._width=parameters.width?parameters.width:null;this._depth=parameters.depth?parameters.depth:null;this._scene=parameters.scene?parameters.scene:null;this._camera=parameters.camera?parameters.camera:null;this._material=parameters.material?parameters.material:null;this._buildChunkGeometry=parameters.buildChunkGeometry;this._useWorkers=parameters.useWorkers?true:false;this._detailRanges=parameters.detailRanges;this._chunkHoverRange=parameters.chunkHoverRange;this._chunkShowFarthest=parameters.chunkShowFarthest;this._position=parameters.position?parameters.position:{x:0,y:0,z:0};this._mapIndex=parameters.mapIndex;this._heightMap=parameters.heightMap;this._heightMapLength=parameters.heightMapLength;this._heightMapWidth=parameters.heightMapWidth;this._heightMapDepth=parameters.heightMapDepth;this._heightMapWidthZero=parameters.heightMapWidthZero;this._heightMapDepthZero=parameters.heightMapDepthZero;this._geometry=null;this._mesh=null;this._updating=false;this._currentGeometryDistanceIndex=false;this._currentXVertices=null;this._currentZVertices=null;};THREE.DynamicTerrainMapChunk.prototype.updateChunkGeometry=function(distanceIndex,xVertices,zVertices,xOffset,zOffset,bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets){this._currentXVertices=xVertices;this._currentZVertices=zVertices;var numberOfVerts=xVertices*zVertices;var triangles=(xVertices-1)*(zVertices-1)*2;var bufferGeometryIndicesLength=(triangles*3);var bufferGeometryPositionsLength=(numberOfVerts*3);var bufferGeometryNormalsLength=(numberOfVerts*3);var bufferGeometryUvsLength=(numberOfVerts*2);var bufferGeometry=new THREE.BufferGeometry();bufferGeometry.attributes={index:{itemSize:1,array:bufferGeometryIndices,numItems:bufferGeometryIndicesLength},position:{itemSize:3,array:bufferGeometryPositions,numItems:bufferGeometryPositionsLength},normal:{itemSize:3,array:bufferGeometryNormals,numItems:bufferGeometryNormalsLength},uv:{itemSize:2,array:bufferGeometryUvs,numItems:bufferGeometryUvsLength}};bufferGeometry.offsets=bufferGeometryOffsets;if(this._mesh!=null){this._scene.remove(this._mesh);delete this._mesh;delete this._geometry;}if(this._mapIndex==0){}this._geometry=bufferGeometry;this._mesh=new THREE.Mesh(this._geometry,this._material);var yOffset=0;this._mesh.position.set(this._position.x+xOffset,this._position.y+yOffset,this._position.z+zOffset);this._scene.add(this._mesh);this._updating=false;};THREE.DynamicTerrainMapChunk.prototype.checkGeometry=function(){if(this._currentGeometryDistance==null||!this._updating){var index=this._geometryDistanceIndex();if(this._camera.position.y<=this._chunkHoverRange&&((this._position.x-(this._width/2))>=this._camera.position.x&&(this._position.x+(this._width/2))<=this._camera.position.x&&(this._position.z-(this._depth/2))>=this._camera.position.z&&(this._position.z+(this._depth/2))<=this._camera.position.z)){this._currentGeometryDistanceIndex=0;}if(index!=this._currentGeometryDistanceIndex){this._currentGeometryDistanceIndex=index;this._updateGeometry();}}};THREE.DynamicTerrainMapChunk.prototype.position=function(){return this._position;};THREE.DynamicTerrainMapChunk.prototype._updateGeometry=function(){var _this=this;this._updating=true;if(this._currentGeometryDistanceIndex>=this._detailRanges.length&&!this._chunkShowFarthest){if(this._mesh){scene.remove(this._mesh);delete this._mesh;delete this._geometry;}return;}if(_this._useWorkers&&_this._buildChunkGeometry){_this._buildChunkGeometry(_this._mapIndex,_this._currentGeometryDistanceIndex,_this._heightMapWidthZero,_this._heightMapDepthZero,_this._width,_this._depth);}else{var xVertices=Math.floor(_this._width/Math.pow(4,_this._currentGeometryDistanceIndex));var zVertices=Math.floor(_this._depth/Math.pow(4,_this._currentGeometryDistanceIndex));var geoWidth=_this._width;var geoDepth=_this._depth;var startWidth=_this._heightMapWidthZero;var startDepth=_this._heightMapDepthZero;var xOffset=0;var zOffset=0;var geoIncrement=Math.pow(4,_this._currentGeometryDistanceIndex);if(_this._heightMapWidthZero!=0){geoWidth+=geoIncrement;xVertices++;xOffset-=geoIncrement/2;startWidth-=geoIncrement;}if((_this._heightMapWidthZero+_this._width+geoIncrement)<_this._heightMapWidth){geoWidth+=geoIncrement;xVertices++;xOffset+=geoIncrement/2;}if(_this._heightMapDepthZero!=0){geoDepth+=geoIncrement;zVertices++;zOffset-=(geoIncrement/2);startDepth-=geoIncrement;}if((_this._heightMapDepthZero+_this._depth+geoIncrement)<_this._heightMapDepth){geoDepth+=geoIncrement;zVertices++;zOffset+=geoIncrement/2;}var numberOfVerts=xVertices*zVertices;var triangles=(xVertices-1)*(zVertices-1)*2;var indices=new Uint16Array(triangles*3);var indicesLength=(triangles*3);var positions=new Float32Array(numberOfVerts*3);var positionsLength=(numberOfVerts*3);var normals=new Float32Array(numberOfVerts*3);var normalsLength=(numberOfVerts*3);var uvs=new Float32Array(numberOfVerts*2);var uvsLength=(numberOfVerts*2);var offsets=[];var chunkSize=21845;var startX=-geoWidth/2;var startZ=-geoDepth/2;var chunkX=geoWidth/(xVertices-1);var chunkZ=geoDepth/(zVertices-1);for(var x=0;x<xVertices;x++){for(var z=0;z<zVertices;z++){var index=(z*xVertices+x)*3;positions[index+0]=startX+x*chunkX;positions[index+1]=_this._heightMap[_this._getHeightMapArrayPosition((xOffset*2)+Math.round(chunkX*x)+startWidth,(zOffset*2)+Math.round(chunkZ*z)+startDepth,_this._width)];positions[index+2]=startZ+z*chunkZ;var uvIndex=(z*xVertices+x)*2;uvs[uvIndex+0]=x/(xVertices-1);uvs[uvIndex+1]=1-z/(zVertices-1);}}var lastChunkRow=0;var lastChunkVertStart=0;for(var x=0;x<(zVertices-1);x++){var startVertIndex=x*xVertices;if((startVertIndex-lastChunkVertStart)+xVertices*2>chunkSize){var newChunk={start:lastChunkRow*(xVertices-1)*6,index:lastChunkVertStart,count:(x-lastChunkRow)*(xVertices-1)*6};offsets.push(newChunk);lastChunkRow=x;lastChunkVertStart=startVertIndex;}for(var z=0;z<(xVertices-1);++z){var index=(x*(xVertices-1)+z)*6;var vertIndex=(x*xVertices+z)-lastChunkVertStart;indices[index+0]=vertIndex;indices[index+1]=vertIndex+xVertices;indices[index+2]=vertIndex+1;indices[index+3]=vertIndex+1;indices[index+4]=vertIndex+xVertices;indices[index+5]=vertIndex+xVertices+1;}}var lastChunk={start:lastChunkRow*(xVertices-1)*6,index:lastChunkVertStart,count:((zVertices-1)-lastChunkRow)*(xVertices-1)*6};if(this._mapIndex==0){console.log("b: "+startX+","+startZ+" : "+xOffset+","+zOffset);}offsets.push(lastChunk);_this.updateChunkGeometry(_this._currentGeometryDistanceIndex,xVertices,zVertices,xOffset,zOffset,indices,positions,normals,uvs,offsets);}};THREE.DynamicTerrainMapChunk.prototype._geometryDistanceIndex=function(){var cameraDistance=this._cameraDistance();var i;for(i=0;i<this._detailRanges.length;i++){if(cameraDistance<this._detailRanges[i]){return i;}}return i;};THREE.DynamicTerrainMapChunk.prototype._cameraDistance=function(){return Math.sqrt(Math.pow((this._position.x-this._camera.position.x),2)+Math.pow((this._position.y-this._camera.position.y),2)+Math.pow((this._position.z-this._camera.position.z),2));};THREE.DynamicTerrainMapChunk.prototype._getHeightMapArrayPosition=function(widthPosition,depthPosition){return(depthPosition*this._heightMapWidth+widthPosition);};THREE.DynamicTerrainMapChunkBuilder=function(){this._width=null;this._depth=null;this._heightMap=null;this._heightMapLength=null;this._sendChunkGeometry=null;this._requestQueue=null;this._workers=null;};THREE.DynamicTerrainMapChunkBuilder.prototype.init=function(options){this._width=options.width;this._depth=options.depth;this._heightMap=options.heightMap;this._heightMapLength=options.heightMapLength;this._sendChunkGeometry=options.sendChunkGeometry;this._workerScriptLocation=options.workerScriptLocation;var workerCount=options.workerCount?options.workerCount:1;this._workers=[];this._workersReady=[];this._requestQueue=[];var self=this;for(var i=0;i<workerCount;i++){this._workers[i]=new Worker(this._workerScriptLocation);this._workers[i].onmessage=function(e){self._workerCallback(e,self);};this._workersReady[i]=false;this._workers[i].postMessage({action:"init",actionData:{id:i,width:this._width,depth:this._depth,heightMap:this._heightMap,heightMapLength:this._heightMapLength}});}};THREE.DynamicTerrainMapChunkBuilder.prototype.setHeight=function(x,z,height){if(!this._heightMap[this._getHeightMapArrayPosition(x,z)]){return;}this._heightMap[this._getHeightMapArrayPosition(x,z)]=height;for(var i=0;i<workerCount;i++){this._workers[i].postMessage({action:"setHeight",actionData:{x:x,z:z,height:height}});}};THREE.DynamicTerrainMapChunkBuilder.prototype._getHeightMapArrayPosition=function(widthPosition,depthPosition){return(depthPosition*this._width+widthPosition);};THREE.DynamicTerrainMapChunkBuilder.prototype._workerCallback=function(e,self){var workerId=e.data.id;if(e.data.action=="init"){self._getNextJob(workerId,self);}else{var mapChunkIndex=e.data.mapChunkIndex;var distanceIndex=e.data.distanceIndex;var bufferGeometryIndices=e.data.bufferGeometryIndices;var bufferGeometryPositions=e.data.bufferGeometryPositions;var bufferGeometryNormals=e.data.bufferGeometryNormals;var bufferGeometryUvs=e.data.bufferGeometryUvs;var bufferGeometryOffsets=e.data.bufferGeometryOffsets;var xVertices=e.data.xVertices;var zVertices=e.data.zVertices;var xOffset=e.data.xOffset;var zOffset=e.data.zOffset;self._sendChunkGeometry(mapChunkIndex,distanceIndex,xVertices,zVertices,xOffset,zOffset,bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);self._getNextJob(workerId,self);}};THREE.DynamicTerrainMapChunkBuilder.prototype._getNextJob=function(workerId,self){if(this._requestQueue.length>0){var request=this._requestQueue.shift();this._workers[workerId].postMessage({action:"build",actionData:request});}else{this._workersReady[workerId]=true;}};THREE.DynamicTerrainMapChunkBuilder.prototype.updateChunkGeometry=function(request){var insert=true;for(var i=0;i<this._requestQueue.length;i++){if(this._requestQueue[i].mapChunkIndex==request.mapChunkIndex){insert=false;this._requestQueue[i].distanceIndex=request.distanceIndex;}}if(insert){this._requestQueue.push(request);this._assignEmptyWorkers();}else{}};THREE.DynamicTerrainMapChunkBuilder.prototype._assignEmptyWorkers=function(){for(var i=0;i<this._workersReady.length;i++){if(this._workersReady[i]){this._getNextJob(i);}}};

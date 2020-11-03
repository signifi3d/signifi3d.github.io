var formValues = {};
var restMap = null;

var greenMarker = new  L.Icon({
		iconUrl: 'img/marker-icon-green.png',
		shadowUrl: 'img/marker-shadow.png',
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41]
});
var orangeMarker = new  L.Icon({
		iconUrl: 'img/marker-icon-orange.png',
		shadowUrl: 'img/marker-shadow.png',
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41]
});
var redMarker = new  L.Icon({
		iconUrl: 'img/marker-icon-red.png',
		shadowUrl: 'img/marker-shadow.png',
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41]
});


function bindPopups(feature, layer) {
	if (feature.properties) {
		var popupContent = ''
		popupContent += feature.properties.rest_name + "<br />";
		popupContent += "<b>Address:</b> " + feature.properties.address + "<br />";
		popupContent += "<b>Type:</b> " + feature.properties.rest_type + "<br />";
		popupContent += "<b>Status:</b> " + feature.properties.rest_status + "<br />";
		popupContent += "<b>Last Inspection:</b> " + feature.properties.last_inspection + "<br />";
		popupContent += "<b>Last Score:</b> ";
		if (feature.properties.last_score === undefined || feature.properties.last_score === "0") {
			popupContent += "Not scored.<br />";
		}
		else {
			popupContent += feature.properties.last_score + "<br />";
		}
		popupContent += "<b>Average Score:</b> ";
		if (feature.properties.avg_score === undefined || feature.properties.avg_score === "0") {
			popupContent += "Not scored.<br />";
		}
		else {
			popupContent += feature.properties.avg_score + "<br />";
		}
		popupContent += "<a target='_blank' href='https://healthspace.com/Clients/Oregon/Multnomah/Web.nsf/formFacility.xsp?id=" + feature.properties.rest_id + "'>Go to facility inspection page.</a><br />";
		layer.bindPopup(popupContent);
	}
}			

function validateScoreRange( min, max ) {
	var convertedMin = Number(min);
	var convertedMax = Number(max);
	if ( convertedMin < 0 || convertedMin > convertedMax ) convertedMin = 0;
	if ( convertedMax > 100 || convertedMax < convertedMin ) convertedMax = 100;

	return [convertedMin, convertedMax];
}

function loadFormValues() {
	var formDict = {};
	var form = $("form input:checkbox");
	var scoreRange = validateScoreRange($("input[name='min-score']").val(), $("input[name='max-score']").val());
	for (var result = 0; result < form.length; result++) {
		formDict[form[result].name] = form[result].checked;
	}
	formDict['min-score'] = scoreRange[0];
	formDict['max-score'] = scoreRange[1];
	formDict['color-by'] = $("form input[name='color-by']:checked").val();
	formDict['name-search'] = $("form input[name='name-search']").val();
	return formDict;
}

function searchMatch(searchTerm, matchTerm) {
	var regExSearchPattern = '';
	for ( var i = 0; i < searchTerm.length; i++ ) {
		searchChar = searchTerm[i];
		if ( searchChar.match(/[A-Za-z]/) ) {
			regExSearchPattern += '[' + searchChar.toUpperCase() + searchChar.toLowerCase() + ']';
		} else if ( searchChar.match(/[0-9]/) ) {
			regExSearchPattern += searchChar;
		} else {
			regExSearchPattern += searchChar + '?';
		}
	}
	return matchTerm.match( new RegExp(regExSearchPattern));
}

function featureFilter(feature, layer) {
	var colorScore;
	if (formValues['color-by'] === "avg_score") {
		colorScore = feature.properties.avg_score;
	}
	else {
		colorScore = feature.properties.last_score;
	}
	if ( !formValues['restaurant'] && feature.properties.rest_type === "Restaurant") return false;
	if ( !formValues['class4'] && feature.properties.rest_type === "Class 4") return false;
	if ( !formValues['class3'] && feature.properties.rest_type === "Class 3") return false;
	if ( !formValues['class2'] && feature.properties.rest_type === "Class 2") return false;
	if ( !formValues['class1'] && feature.properties.rest_type === "Class 1") return false;
	if ( !formValues['Vending'] && feature.properties.rest_type === "Vending") return false;
	if ( !formValues['Commissary'] && feature.properties.rest_type === "Commissary") return false;
	if ( !formValues['Warehouse'] && feature.properties.rest_type === "Warehouse") return false;
	if ( !formValues['Food-B&B'] && feature.properties.rest_type === "Food-B&B") return false;
	if ( !formValues['permitted'] && feature.properties.rest_status === "Permitted") return false;
	if ( !formValues['surveillance'] && feature.properties.rest_status === "Surveillance") return false;
	if ( !formValues['pending'] && feature.properties.rest_status === "Pending") return false;
	if ( !formValues['enforcement'] && feature.properties.rest_status === "Enforcement") return false;
	if ( !formValues['additional'] && feature.properties.rest_status === "Awaiting Additional Information") return false;
	if ( !formValues['outofbusiness'] && feature.properties.rest_status === "Out of Business") return false;
	if ( formValues['exclude-no-score'] && feature.properties.avg_score === undefined) return false;
	if ( colorScore < formValues['min-score'] || colorScore > formValues['max-score'] ) return false;
	if ( formValues['name-search'] != '' ) return searchMatch(formValues['name-search'], feature.properties.rest_name);
	return true;
	
}

function setMarkers(feature, latlng) {
	var colorScore;
	console.log(feature.properties.rest_name + " " + formValues['color-by']);
	if (formValues['color-by'] === "avg_score") {
		colorScore = feature.properties.avg_score;
	}
	else {
		colorScore = feature.properties.last_score;
	}
	if (colorScore >= 90) {
		return new L.marker(latlng, { icon: greenMarker });
	} else if (colorScore >= 80) {
		return new L.marker(latlng, { icon: orangeMarker });
	} else if (colorScore > 0 && colorScore < 80) {
		return new L.marker(latlng, { icon: redMarker });
	} else {
		return new L.marker(latlng);
	}
}


function loadMap() {
	restMap = L.map('mapid').setView([45.53, -122.6],13);
	L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    		maxZoom: 18,
    		id: 'mapbox.streets',
    		accessToken: 'pk.eyJ1IjoiYndlMDAxMSIsImEiOiJjanBuMjdyaG8wYnR6NDNwYjNxZ2wwd210In0.2n3mXMQOfGV9RDrEBgVvCQ'
	}).addTo(restMap);
	
	formValues = loadFormValues();
	$.getJSON('restInfo.json', function(data){
		L.geoJSON(data['features'], {filter: featureFilter, pointToLayer: setMarkers, onEachFeature:bindPopups}).addTo(restMap);
	});		
}

function reloadMap(event) {
	event.preventDefault();
	restMap.remove();
	loadMap();
}

function initMap() {
  const firebaseConfig = {

    apiKey: "AIzaSyDiVgERgc7HiDl3SrRkyerM8TFaNO4wPQk",

    authDomain: "mgbs-83a70.firebaseapp.com",

    projectId: "mgbs-83a70",

    storageBucket: "mgbs-83a70.appspot.com",

    messagingSenderId: "120470861866",

    appId: "1:120470861866:web:0d5fec89a97bd526706b53"

  };

  // Initialize Firebase

  const app = window.firebase.initializeApp(firebaseConfig);

  const montclair = { lat: 40.8259, lng: -74.2090 };
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 13,
    center: montclair,
  });

  var clusterRenderer = {
    render: (cluster, stats, map)=>{
      let count = cluster.count;

      // create svg url with fill color
      const svg = window.btoa(`
      <svg fill="#0010ff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
        <circle cx="120" cy="120" opacity=".6" r="70" />
        <circle cx="120" cy="120" opacity=".3" r="90" />
        <circle cx="120" cy="120" opacity=".2" r="110" />
        <circle cx="120" cy="120" opacity=".1" r="130" />
      </svg>`);

      // create marker using svg icon
      return new google.maps.Marker({
        position: cluster.position,
        icon: {
          url: `data:image/svg+xml;base64,${svg}`,
          scaledSize: new google.maps.Size(45, 45),
        },
        label: {
          text: String(count),
          color: "rgba(255,255,255,0.9)",
          fontSize: "12px",
        },
        // adjust zIndex to be above other markers
        zIndex: 1000 + count,
      });
    },
  };
  var clusterer = new markerClusterer.MarkerClusterer({
    map: map,
    renderer: clusterRenderer
   });

  let bikesListElement = document.getElementById('bikesList');
  let checkOutControls = document.getElementById('checkOutControls');
  let checkInControls = document.getElementById('checkInControls');

  let checkOutButton = document.getElementById('checkOutButton');
  let checkInButton = document.getElementById('checkInButton');
  let locationRefreshButton = document.getElementById('locationRefreshButton');

  let locationField = document.getElementById('locationField');

  const db = firebase.firestore(app);

  let bikes = db.collection('BikeStatus');
  let errorCollection = db.collection('IssueReports');
  let transactionCollection = db.collection('Transactions');

  bikesListElement.innerHTML = '';
  var markerList = [];

  var location = null;

  // Pick your pin (hole or no hole)
  var pinSVGHole = "M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z";
  var labelOriginHole = new google.maps.Point(12, 15);
  var pinSVGFilled = "M 12,2 C 8.1340068,2 5,5.1340068 5,9 c 0,5.25 7,13 7,13 0,0 7,-7.75 7,-13 0,-3.8659932 -3.134007,-7 -7,-7 z";
  var labelOriginFilled = new google.maps.Point(12, -5);

  let selectedBike = false;

  function getColor(status) {
    if (status == 0) {
      // available
      return '#00FF00';
    }
    if (status == 1) {
      // checked out
      return '#FF0000';
    }
    if (status == 2) {
      // missing
      return '#111111';
    }
    if (status == 3) {
      // broken
      return '#AA00AA';
    }
  }

  function GenerateMarkerImage(color, labelOrigin){
    return {
      path: pinSVGFilled,
      anchor: new google.maps.Point(12, 17),
      fillOpacity: 1,
      fillColor: color,
      strokeWeight: 3,
      strokeColor: "black",
      scale: 2,
      labelOrigin: labelOrigin??labelOriginFilled
    };
  };

  function selectBike(data) {
    setLocation(null);

    if(selectedBike)
    {
      let currentMark = markerList[selectedBike.guid];
      currentMark.setPosition(new google.maps.LatLng(selectedBike.location._lat, selectedBike.location._long));
      currentMark.setIcon(GenerateMarkerImage(getColor(selectedBike.status)));
      clusterer.clearMarkers();
      clusterer.addMarkers(markerList);
      clusterer.render();
    }

    selectedBike = data;
    bikesListElement.value = data.guid;
    checkOutControls.style = `visibility: ${data.status === 0 ? 'visible' : 'hidden; position: absolute;'};`;
    checkInControls.style = `visibility: ${data.status != 0 ? 'visible' : 'hidden; position: absolute;'};`;
  }

  let bikeDocDict = {};
  function getSelectedBikeDoc(callback) {
    callback(bikeDocDict[selectedBike.guid]);
  }

  bikesListElement.addEventListener("change", () => {
    selectBike(bikeDocDict[bikesListElement.value].data());
  });

  checkOutButton.addEventListener("click", () => {
    getSelectedBikeDoc(doc => {
      doc.ref.update({
        status: 1,
        lastChangeTime: firebase.firestore.FieldValue.serverTimestamp()
      });


      transactionCollection.add({
        bikeGuid: doc.data().guid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 1,
        location: doc.data().location,
      });
    });
  });

  function setLocation(loc)
  {
    location = loc;
    if(location)
    {
      var mark = markerList[selectedBike.guid];
      locationField.value = `${loc.lat},${loc.long}`;
      mark.setPosition(new google.maps.LatLng(loc.lat, loc.long));
      mark.setIcon(GenerateMarkerImage("#000fff"));
      checkInButton.disabled = false;
    }
    else
    {
      locationField.value = null;
      checkInButton.disabled = true;
    }
    clusterer.clearMarkers();
    clusterer.addMarkers(markerList);
    clusterer.render();
  }
  setLocation(null);

  map.addListener("click", (mapsMouseEvent) => {
    if(selectedBike.status == 1)
    {
      setLocation(
        {
          lat: mapsMouseEvent.latLng.lat(),
          long: mapsMouseEvent.latLng.lng(),
        }
      );
    }
  });


  function refreshLocation(callback)
  {
    // Check if geolocation is supported by the browser
    if ("geolocation" in navigator) {
      // Prompt user for permission to access their location
      navigator.geolocation.getCurrentPosition(
        // Success callback function
        (position) => {
          // Get the user's latitude and longitude coordinates
          const lat = position.coords.latitude;
          const long = position.coords.longitude;

          setLocation({
            lat: lat,
            long: long,
          });
          if(callback)
          {
            callback();
          }
        },
        // Error callback function
        (error) => {
          // Handle errors, e.g. user denied location sharing permissions
          console.error("Error getting user location:", error);
          if(callback)
          {
            callback();
          }
        }
      );
    } else {
      // Geolocation is not supported by the browser
      console.error("Geolocation is not supported by this browser.");
    }
  }
  
  locationRefreshButton.addEventListener("click", () => {refreshLocation();});

  function checkInBike()
  {
    getSelectedBikeDoc(doc => {
      doc.ref.update({
        location: {
          _lat: location.lat,
          _long: location.long,
        },
        status: 0,
        lastChangeTime: firebase.firestore.FieldValue.serverTimestamp()
      });


      transactionCollection.add({
        bikeGuid: doc.data().guid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 0,
        location: {
          _lat: location.lat,
          _long: location.long,
        },
      });
    });
  }

  checkInButton.addEventListener("click", () => {
    
    if(!location)
    {
      refreshLocation(()=>{
        if(location)
        {
          checkInBike();
        }
      });
    }
    else
    {
      checkInBike();
    }
    
  });

  let sendReportButton = document.getElementById('sendReportButton');
  sendReportButton.addEventListener('click', () => {
    getSelectedBikeDoc(doc => {
      let missingCheck = document.getElementById("missingProblemCheckbox");
      let flatCheck = document.getElementById("flatProblemCheckbox");
      let errorCode = -1;
      if (missingCheck.checked) {
        doc.ref.update({ status: 2 });
        errorCode = 1;
      }
      else {
        if (flatCheck.checked) {
          doc.ref.update({ status: 3 });
          errorCode = 2;
        }
      }
      missingCheck.checked = false;
      flatCheck.checked = false;

      errorCollection.add({
        bikeGuid: doc.data().guid,
        details: document.getElementById('detailsField').value,
        errorCode: errorCode,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  });

  
  bikes.onSnapshot(qs => {
    bikesListElement.innerHTML = '';
    markerList.forEach(m => m.setMap(null));
    markerList = [];

    qs.docs.forEach(doc => {
      let data = doc.data();
      bikeDocDict[data.guid] = doc;
      bikesListElement.innerHTML += `<option value=\"${data.guid}\">${data.name}</option>`;

      var label = {
        text: data.name,
        color: "black",
        fontSize: "18px",
      };

      let mark = new google.maps.Marker({
        position: new google.maps.LatLng(data.location._lat, data.location._long),
        map,
        label: label,
        icon: GenerateMarkerImage(getColor(data.status)),
      });

      mark.addListener('click', () => {
        selectBike(data);
      });

      markerList[data.guid] = mark;

      if (!selectedBike) {
        selectBike(data)
      }
      else {
        if (selectedBike.guid == data.guid) {
          selectBike(data);
        }
      }
    });
    selectBike(selectedBike);
    
    clusterer.clearMarkers();
    clusterer.addMarkers(markerList);
  });
}
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
    
let bikesListElement = document.getElementById('bikesList');
let checkOutControls = document.getElementById('checkOutControls');
let checkInControls = document.getElementById('checkInControls');

let checkOutButton = document.getElementById('checkOutButton');
let checkInButton = document.getElementById('checkInButton');

const db = firebase.firestore(app);

let bikes = db.collection('BikeStatus');

bikesListElement.innerHTML = '';
var markerList = [];

// Pick your pin (hole or no hole)
var pinSVGHole = "M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z";
var labelOriginHole = new google.maps.Point(12,15);
var pinSVGFilled = "M 12,2 C 8.1340068,2 5,5.1340068 5,9 c 0,5.25 7,13 7,13 0,0 7,-7.75 7,-13 0,-3.8659932 -3.134007,-7 -7,-7 z";
var labelOriginFilled =  new google.maps.Point(12,-5);

let selectedBike = {};
function selectBike(data) {
  selectedBike = data;
  checkOutControls.style = `visibility: ${data.status === 0?'visible':'hidden'};`;
  checkInControls.style = `visibility: ${data.status === 1?'visible':'hidden'};`;
}

bikesListElement.addEventListener("change", ()=>{
  bikes.where('guid', '==', bikesListElement.value).get().then(qs=>selectBike(qs.docs[0].data()));
});

checkOutButton.addEventListener("click", () => {
  bikes.where('guid', '==', bikesListElement.value).get().then(qs=>{
    let doc = qs.docs[0];
    doc.ref.update({
      status: 1,
      lastChangeTime: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
});

checkInButton.addEventListener("click", () => {

  // Check if geolocation is supported by the browser
if ("geolocation" in navigator) {
  // Prompt user for permission to access their location
  navigator.geolocation.getCurrentPosition(
    // Success callback function
    (position) => {
      // Get the user's latitude and longitude coordinates
      const lat = position.coords.latitude;
      const long = position.coords.longitude;

      bikes.where('guid', '==', bikesListElement.value).get().then(qs=>{
        let doc = qs.docs[0];
        doc.ref.update({
          location: {
            _lat: lat,
            _long: long,
          },
          status: 0,
          lastChangeTime: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    },
    // Error callback function
    (error) => {
      // Handle errors, e.g. user denied location sharing permissions
      console.error("Error getting user location:", error);
    }
  );
} else {
  // Geolocation is not supported by the browser
  console.error("Geolocation is not supported by this browser.");
}


  
});

let selectionInited = false;

bikes.onSnapshot(qs=>{
  bikesListElement.innerHTML = '';
    markerList.forEach(m => m.setMap(null));
    markerList = [];

    qs.docs.forEach(doc=>{
      let data = doc.data();
      bikesListElement.innerHTML += `<option value=\"${data.guid}\">${data.name}</option>`;
      if(!selectionInited)
      {
        selectBike(data);
        selectionInited = true;
      }

      var markerImage = {
        path: pinSVGFilled,
        anchor: new google.maps.Point(12,17),
        fillOpacity: 1,
        fillColor: data.status==0 ? '#00FF00' : '#FF0000',
        strokeWeight: 3,
        strokeColor: "black",
        scale: 2,
        labelOrigin: labelOriginFilled
      };

      var label = {
        text: data.name,
        color: "black",
        fontSize: "18px",
      };

      let mark = new google.maps.Marker({
        position: new google.maps.LatLng(data.location._lat, data.location._long),
        map,
        label: label,
        icon: markerImage,
      });

      mark.addListener('click', () =>
      {
        bikesListElement.value = data.guid;
        selectBike(data);
      });

      markerList[markerList.length] = mark;
    }
    );
});
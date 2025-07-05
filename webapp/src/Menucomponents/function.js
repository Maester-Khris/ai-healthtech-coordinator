function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}
//attention here position are [long, lat]
var batchdata = JSON.stringify({
  "mode": "drive",
  "sources": [
    { "location": [8.73784862216246, 48.543061473317266] },
    { "location": [9.305536080205002, 48.56743450655594] },
    { "location": [9.182792846033067, 48.09414029055267] }
  ],
  "targets": [
    { "location": [8.73784862216246, 48.543061473317266] },
    { "location": [9.305536080205002, 48.56743450655594] },
    { "location": [9.182792846033067, 48.09414029055267] }
  ]
});


var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json")
var requestOptions = {
  method: 'POST',
  headers: myHeaders,
  body: batchdata
};

fetch("https://api.geoapify.com/v1/routematrix?apiKey=", requestOptions)
  .then(response => response.json())
  .then(result => {
    console.log(result);
    //build routes list with people provider, distance and eta time
  })
  .catch(error => console.log('error', error));


//exemple of responses
res_data = {
  "sources": [
    {
      "original_location": [-0.26638280549582305, 51.65957511654639], "location": [-0.266383, 51.659575]
    },
    {
      "original_location": [0.21039127548920078, 51.59230741451023], "location": [0.210391, 51.592307]
    },
    {
      "original_location": [0.42710676684589544, 51.25899230131458], "location": [0.427107, 51.258992]
    }
  ],
  "targets": [
    {
      "original_location": [-0.4830982968514945, 51.364354146777686], "location": [-0.483098, 51.364354]
    },
    {
      "original_location": [-0.47105854733172237, 51.221304423124735], "location": [-0.471059, 51.221304]
    },
    {
      "original_location": [-0.07133886327437722, 51.1669796234099], "location": [-0.071339, 51.16698]
    }
  ],
  "sources_to_targets": [
    [
      { "distance": 67406, "time": 2366, "source_index": 0, "target_index": 0 },
      { "distance": 87230, "time": 3182, "source_index": 0, "target_index": 1 },
      { "distance": 111531, "time": 3921, "source_index": 0, "target_index": 2 }
    ], 
    [
      { "distance": 103070, "time": 3641, "source_index": 1, "target_index": 0 },
      { "distance": 106858, "time": 3945, "source_index": 1, "target_index": 1 },
      { "distance": 73479, "time": 2772, "source_index": 1, "target_index": 2 }
    ], 
    [
      { "distance": 82952, "time": 3013, "source_index": 2, "target_index": 0 },
      { "distance": 86740, "time": 3317, "source_index": 2, "target_index": 1 },
      { "distance": 53361, "time": 2144, "source_index": 2, "target_index": 2 }
    ]
  ]
}


// const routesToProviders = useMemo(() => {
//     const routes:any[] = [];
//     peoplesPositions.forEach(person => {
//       let closestProvider: Entity | null = null;
//       let minDistance = Infinity;

//       // Find the closest provider for the current person
//       healthProviders.forEach(provider => {
//         const distance = haversineDistance(
//           person.position[0], person.position[1],
//           provider.position[0], provider.position[1]
//         );
//         if (distance < minDistance) {
//           minDistance = distance;
//           closestProvider = provider;
//         }
//       });

//       // If a closest provider is found, add the polyline data
//       if (closestProvider) {
//         routes.push({
//           person: person,
//           provider: closestProvider,
//           distance: minDistance // Store distance if you want to display it
//         });
//       }
//     });
//     return routes;
// }, [peoplesPositions, healthProviders]);
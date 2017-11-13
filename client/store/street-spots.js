import axios from 'axios';
import GeoJSON from 'geojson';
import mapboxgl from 'mapbox-gl';
import { getUserLocation } from '../helpers'
import socket from '../socket';

/**
 * ACTION TYPES
 */
 const GET_SPOTS = 'GET_SPOTS';

 /**
 * INITIAL STATE
 */
const defaultSpots = [];

/**
 * ACTION CREATORS
 */
const getSpots = spots => ({type: GET_SPOTS, spots});

/**
 * THUNK CREATORS
 */
const fetchAddress = (coor) => {
  const [lat, lng] = coor;
  return axios.get('https://api.mapbox.com/geocoding/v5/mapbox.places/' + lat + ',' + lng + '.json?access_token=' + mapboxgl.accessToken)
  .then(res => res.data)
  .then( data => {
    return data.features[0].place_name;
  })
  .catch(err => console.log(err));
};

export const fetchSpots = (map) =>
  dispatch =>
    axios.get('/api/streetspots')
      .then( res => res.data)
      .then( spotLatLong => {
        return GeoJSON.parse(spotLatLong, {Point: ['latitude', 'longitude']});
      })
      .then(spots => {
        spots.features.forEach(function(spot) {
            // create the marker
            var el = document.createElement('div');
            el.className = 'marker';
            fetchAddress(spot.geometry.coordinates)
            .then( place => {
              spot.place_name = place;
              // create the popup
              var popup = new mapboxgl.Popup()
              .setText(`Size: ${ spot.properties.size }`);
              new mapboxgl.Marker(el)
              .setLngLat(spot.geometry.coordinates)
              .setPopup(popup) // sets a popup on this marker
              .addTo(map);
            })
          });
        dispatch(getSpots(spots || defaultSpots));
      })
      .catch(err => console.log(err));

export const addSpotOnServer = (map, userId, defaultVehicle) =>
  dispatch =>
   getUserLocation()
      .then( position => {
        const { longitude, latitude } = position.coords;
        const spot = { longitude, latitude, size: defaultVehicle || null } //eventually need to pull in default vehicle
        return axios.post(`/api/streetspots/${ userId }`, spot)})
      .then( () => dispatch(fetchSpots(map)))
      .catch(err => console.log(err));

export const deleteSpotOnServer = (spotId) =>
  dispatch =>
    axios.delete(`/api/streetspots/${ spotId }`)
      .then( () => dispatch(fetchSpots()))
      .catch(err => console.log(err));

export const takeSpot = (id) =>
  dispatch =>
    axios.put(`/api/streetspots/${ id }`)
    .then(result => result.data)
    .then( reporter => {
      dispatch(fetchSpots());
      console.log(reporter);
      if (reporter.socketId) {
        socket.emit('spot-taken-online', reporter.socketId);
      } else {
        socket.emit('spot-taken-offline', reporter.id);
      }
    })
    .catch( err => console.log(err));

/**
 * REDUCER
 */

export default function (state = defaultSpots, action) {
  switch (action.type) {
    case GET_SPOTS:
      return action.spots;
    default:
      return state;
  }
}

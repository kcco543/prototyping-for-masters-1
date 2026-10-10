/**
 * Weather Cat — the cities that get a pin on the world map.
 *
 * This list is used in two places:
 *   - the map (`world-map.tsx`) draws one pin for each city, and
 *   - the server route `api/cities/route.ts` asks for each city's weather.
 *
 * To add a city, add a line. Three things to keep in mind:
 *   - Round the coordinates to 2 decimal places, like the rest of the list.
 *     (Latitude is north/south, longitude is east/west. West and south are
 *     negative numbers.)
 *   - Keep pins about 10 degrees apart. Closer than that and they overlap on
 *     a phone, which is why Paris is missing: it is next door to London.
 *   - Every city costs one OpenWeatherMap request each time the map's weather
 *     is refreshed. The free plan allows 60 a minute, so stay well under 60.
 */

import type { Place } from "./weather";

export const CITIES: Place[] = [
  // North America and the Pacific
  { name: "Honolulu", country: "US", lat: 21.31, lon: -157.86 },
  { name: "Anchorage", country: "US", lat: 61.22, lon: -149.9 },
  { name: "Vancouver", country: "CA", lat: 49.28, lon: -123.12 },
  { name: "Los Angeles", country: "US", lat: 34.05, lon: -118.24 },
  { name: "Mexico City", country: "MX", lat: 19.43, lon: -99.13 },
  { name: "Chicago", country: "US", lat: 41.88, lon: -87.63 },
  { name: "Miami", country: "US", lat: 25.76, lon: -80.19 },
  { name: "New York", country: "US", lat: 40.71, lon: -74.01 },

  // South America
  { name: "Bogotá", country: "CO", lat: 4.71, lon: -74.07 },
  { name: "Lima", country: "PE", lat: -12.05, lon: -77.04 },
  { name: "Buenos Aires", country: "AR", lat: -34.6, lon: -58.38 },
  { name: "Rio de Janeiro", country: "BR", lat: -22.91, lon: -43.17 },

  // Europe
  { name: "Reykjavik", country: "IS", lat: 64.15, lon: -21.94 },
  { name: "Madrid", country: "ES", lat: 40.42, lon: -3.7 },
  { name: "London", country: "GB", lat: 51.51, lon: -0.13 },
  { name: "Rome", country: "IT", lat: 41.9, lon: 12.5 },
  { name: "Berlin", country: "DE", lat: 52.52, lon: 13.4 },
  { name: "Istanbul", country: "TR", lat: 41.01, lon: 28.98 },
  { name: "Moscow", country: "RU", lat: 55.76, lon: 37.62 },

  // Africa
  { name: "Dakar", country: "SN", lat: 14.72, lon: -17.47 },
  { name: "Lagos", country: "NG", lat: 6.52, lon: 3.38 },
  { name: "Cape Town", country: "ZA", lat: -33.92, lon: 18.42 },
  { name: "Cairo", country: "EG", lat: 30.04, lon: 31.24 },
  { name: "Nairobi", country: "KE", lat: -1.29, lon: 36.82 },

  // Asia
  { name: "Dubai", country: "AE", lat: 25.2, lon: 55.27 },
  { name: "Mumbai", country: "IN", lat: 19.08, lon: 72.88 },
  { name: "Delhi", country: "IN", lat: 28.61, lon: 77.21 },
  { name: "Bangkok", country: "TH", lat: 13.76, lon: 100.5 },
  { name: "Singapore", country: "SG", lat: 1.35, lon: 103.82 },
  { name: "Ulaanbaatar", country: "MN", lat: 47.89, lon: 106.91 },
  { name: "Hong Kong", country: "HK", lat: 22.32, lon: 114.17 },
  { name: "Beijing", country: "CN", lat: 39.9, lon: 116.41 },
  { name: "Seoul", country: "KR", lat: 37.57, lon: 126.98 },
  { name: "Tokyo", country: "JP", lat: 35.68, lon: 139.69 },

  // Australia and New Zealand
  { name: "Perth", country: "AU", lat: -31.95, lon: 115.86 },
  { name: "Sydney", country: "AU", lat: -33.87, lon: 151.21 },
  { name: "Auckland", country: "NZ", lat: -36.85, lon: 174.76 },
];

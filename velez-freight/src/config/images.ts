/**
 * Photography registry. Every image is licensed under the Unsplash License
 * (https://unsplash.com/license). Sources and photographers: docs/IMAGE_SOURCES.md.
 * None shows company branding, and photos with visible third party logos were rejected.
 */
export const images = {
  heroTruck: { src: "/images/hero-truck-dusk.jpg", alt: "A semi truck with its headlights on travels a two lane highway at dusk under a warm sky" },
  loadingDocks: { src: "/images/loading-docks.jpg", alt: "A row of loading dock doors on a light colored distribution building" },
  roadSunriseHills: { src: "/images/road-sunrise-hills.jpg", alt: "A winding road through green hills lit by the rising sun" },
  redTruck: { src: "/images/red-truck-highway.jpg", alt: "A red semi truck pulling a white trailer along a highway under a clear sky" },
  roadSunsetFields: { src: "/images/road-sunset-fields.jpg", alt: "An open road curving through farm fields at sunset" },
  whiteTruckMotion: { src: "/images/white-truck-motion.jpg", alt: "A white semi truck moving along a highway through green fields in late afternoon light" },
  trucksMountainHighway: { src: "/images/trucks-mountain-highway.jpg", alt: "Two semi trucks on a highway with blue mountains in the distance" },
  openRoadSunrise: { src: "/images/open-road-sunrise.jpg", alt: "An open road leading toward sunlit hills at sunrise" },
  desertHighwayDusk: { src: "/images/desert-highway-dusk.jpg", alt: "A straight highway with power lines stretching toward the horizon at dusk" },
  desertRoadSunset: { src: "/images/desert-road-sunset.jpg", alt: "An empty road through red rock hills under sunset clouds" },
} as const;

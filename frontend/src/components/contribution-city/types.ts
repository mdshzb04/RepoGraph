export type ContributionCityPeriod = "week" | "month" | "all";

export type CityContributor = {
  id: string;
  login: string;
  avatarUrl: string;
  commits: number;
  mergedPrs: number;
  reviews: number;
  heightScore: number;
  primaryLanguage: string;
  recentActivity: number;
};

export type CityDistrict = {
  id: string;
  name: string;
  fileCount: number;
  inactive: boolean;
};

export type CityBuilding = {
  id: string;
  contributorId: string;
  districtId: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  language: string;
  colorToken: string;
  windowGlow: number;
  hasCrane: boolean;
  maintenanceLevel: number;
  abandoned: boolean;
};

export type CityRoad = {
  id: string;
  fromDistrictId: string;
  toDistrictId: string;
  points: [number, number][];
};

export type CityLandmark = {
  id: string;
  kind: "star" | "fork";
  x: number;
  z: number;
  value: number;
};

export type CityInactiveModule = {
  path: string;
  districtId: string;
};

export type ContributionCityData = {
  fullName: string;
  indexedAt: string;
  generatedAt: string;
  stars: number;
  forks: number;
  openPrs: number;
  openIssues: number;
  districts: CityDistrict[];
  buildings: CityBuilding[];
  roads: CityRoad[];
  landmarks: CityLandmark[];
  contributors: CityContributor[];
  inactiveModules: CityInactiveModule[];
  bounds: { width: number; depth: number };
  githubAvailable: boolean;
};

export type LayoutBuilding = CityBuilding & {
  layoutX: number;
  layoutZ: number;
};

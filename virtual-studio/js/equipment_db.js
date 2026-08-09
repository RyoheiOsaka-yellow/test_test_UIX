/* =========================================================
 * CineOS Equipment Master (cineos/data/equipment_master.json 由来)
 * capability-first の機材アーキタイプ+代表SKUシード。
 * version 2.0 / 131 records
 * ======================================================= */
const EQUIPMENT_DB = [
 {
  "id": "CAM-ARRI-ALEXA35",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "ARRI",
  "model": "ALEXA 35 / Xtreme",
  "capability": {
   "sensor_class": "Super35",
   "dynamic_range_stops": 17,
   "raw": true,
   "high_speed": true
  },
  "use_cases": [
   "feature film",
   "drama",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-SONY-VENICE2",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "Sony",
  "model": "VENICE 2",
  "capability": {
   "sensor_class": "full-frame cinema",
   "raw": true,
   "dual_sensor_options_family": true
  },
  "use_cases": [
   "feature film",
   "drama",
   "VP"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-RED-VRAPTOR",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "RED",
  "model": "V-RAPTOR / V-RAPTOR XL family",
  "capability": {
   "large_format": true,
   "raw": true,
   "high_speed": true
  },
  "use_cases": [
   "film",
   "action",
   "VFX"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-CANON-C400",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "Canon",
  "model": "EOS C400",
  "capability": {
   "sensor_class": "full_frame",
   "resolution": "6K class",
   "high_speed": "4K 120p class",
   "AF": true
  },
  "use_cases": [
   "drama",
   "documentary",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-BMD-URSA12KLF",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "Blackmagic Design",
  "model": "URSA Cine 12K LF",
  "capability": {
   "sensor_mm": [
    35.64,
    23.32
   ],
   "dynamic_range_stops": 16,
   "open_gate": "12288x8040",
   "internal_nd_stops": [
    0,
    2,
    4,
    6
   ]
  },
  "use_cases": [
   "film",
   "drama",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-FREEFLY-EMBER5K",
  "category": "camera",
  "subcategory": "high_speed",
  "manufacturer": "Freefly",
  "model": "Ember S5K",
  "capability": {
   "sensor_class": "Super35",
   "global_shutter": true,
   "weight_g": 800
  },
  "use_cases": [
   "product",
   "liquid",
   "food"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-PHANTOM-TMX7510",
  "category": "camera",
  "subcategory": "ultra_high_speed",
  "manufacturer": "Vision Research",
  "model": "Phantom TMX 7510",
  "capability": {
   "ultra_high_speed": true,
   "scientific": true
  },
  "use_cases": [
   "impact",
   "fracture",
   "liquid"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "CAM-SONY-FX6",
  "category": "camera",
  "subcategory": "compact_cinema",
  "manufacturer": "Sony",
  "model": "FX6",
  "capability": {},
  "use_cases": [
   "documentary",
   "B-camera",
   "gimbal"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-SONY-FX3",
  "category": "camera",
  "subcategory": "compact_cinema",
  "manufacturer": "Sony",
  "model": "FX3",
  "capability": {},
  "use_cases": [
   "gimbal",
   "car rig",
   "social"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-CANON-C80",
  "category": "camera",
  "subcategory": "compact_cinema",
  "manufacturer": "Canon",
  "model": "EOS C80",
  "capability": {},
  "use_cases": [
   "documentary",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-NIKON-Z9",
  "category": "camera",
  "subcategory": "hybrid",
  "manufacturer": "Nikon",
  "model": "Z9",
  "capability": {},
  "use_cases": [
   "sports",
   "wildlife",
   "still"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-CANON-R5II",
  "category": "camera",
  "subcategory": "hybrid",
  "manufacturer": "Canon",
  "model": "EOS R5 Mark II",
  "capability": {},
  "use_cases": [
   "hybrid",
   "small crew"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-PANASONIC-S",
  "category": "camera",
  "subcategory": "hybrid",
  "manufacturer": "Panasonic",
  "model": "LUMIX S family",
  "capability": {},
  "use_cases": [
   "documentary",
   "creator"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-HASSELBLAD-X2DII",
  "category": "camera",
  "subcategory": "medium_format_still",
  "manufacturer": "Hasselblad",
  "model": "X2D II 100C",
  "capability": {},
  "use_cases": [
   "fashion still",
   "beauty",
   "product"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-PHASEONE",
  "category": "camera",
  "subcategory": "medium_format_still",
  "manufacturer": "Phase One",
  "model": "XF / IQ family",
  "capability": {},
  "use_cases": [
   "advertising still",
   "art reproduction"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-GOPRO",
  "category": "camera",
  "subcategory": "action",
  "manufacturer": "GoPro",
  "model": "HERO family",
  "capability": {},
  "use_cases": [
   "POV",
   "sports",
   "water"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-INSTA360",
  "category": "camera",
  "subcategory": "360",
  "manufacturer": "Insta360",
  "model": "Pro / X family",
  "capability": {},
  "use_cases": [
   "360",
   "VR",
   "location capture"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-ARRI-SIGNATURE",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "ARRI",
  "model": "Signature Prime",
  "capability": {},
  "use_cases": [
   "film",
   "drama",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-COOKE-S8",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "Cooke",
  "model": "S8/i",
  "capability": {},
  "use_cases": [
   "film",
   "drama",
   "beauty"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-ZEISS-SUPREME",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "ZEISS",
  "model": "Supreme Prime",
  "capability": {},
  "use_cases": [
   "film",
   "commercial",
   "VFX"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-LEITZ",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "Leitz",
  "model": "Prime family",
  "capability": {},
  "use_cases": [
   "film",
   "luxury"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-ANGENIEUX",
  "category": "lens",
  "subcategory": "cinema_zoom",
  "manufacturer": "Angénieux",
  "model": "Optimo family",
  "capability": {},
  "use_cases": [
   "film",
   "drama"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-ATLAS",
  "category": "lens",
  "subcategory": "anamorphic",
  "manufacturer": "Atlas Lens Co.",
  "model": "Orion / Mercury family",
  "capability": {},
  "use_cases": [
   "film",
   "MV"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-LAOWA-PROBE",
  "category": "lens",
  "subcategory": "probe",
  "manufacturer": "Laowa",
  "model": "24mm Probe family",
  "capability": {},
  "use_cases": [
   "food",
   "product",
   "miniature"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-MACRO100",
  "category": "lens",
  "subcategory": "macro",
  "manufacturer": "Various",
  "model": "90–105mm Macro",
  "capability": {},
  "use_cases": [
   "product",
   "beauty",
   "food"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-SUPERMACRO",
  "category": "lens",
  "subcategory": "supermacro",
  "manufacturer": "Various",
  "model": "2x–5x Super Macro",
  "capability": {},
  "use_cases": [
   "micro texture",
   "scientific"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-TILTSHIFT",
  "category": "lens",
  "subcategory": "tilt_shift",
  "manufacturer": "Canon/Nikon/Various",
  "model": "Tilt-Shift family",
  "capability": {},
  "use_cases": [
   "architecture",
   "product"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-FISHEYE",
  "category": "lens",
  "subcategory": "fisheye",
  "manufacturer": "Various",
  "model": "Fisheye",
  "capability": {},
  "use_cases": [
   "MV",
   "skate",
   "POV"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-VINTAGE",
  "category": "lens",
  "subcategory": "vintage_prime",
  "manufacturer": "Various",
  "model": "Rehoused Vintage Spherical",
  "capability": {},
  "use_cases": [
   "period",
   "drama",
   "MV"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-APUTURE-XT26",
  "category": "lighting",
  "subcategory": "high_output_LED",
  "manufacturer": "Aputure",
  "model": "Electro Storm XT26",
  "capability": {
   "output_power_W": 2600,
   "input_power_max_W": 3500,
   "CCT_K": [
    2700,
    6500
   ],
   "CRI": "96.5+",
   "TLCI": "97+",
   "IP": "IP65"
  },
  "use_cases": [
   "sun recreation",
   "exterior fill",
   "high speed"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-ARRI-SKYPANELX",
  "category": "lighting",
  "subcategory": "LED_panel",
  "manufacturer": "ARRI",
  "model": "SkyPanel X",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-ARRI-ORBITER",
  "category": "lighting",
  "subcategory": "LED_point_source",
  "manufacturer": "ARRI",
  "model": "Orbiter",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-KINO-MIMIK",
  "category": "lighting",
  "subcategory": "image_based_light",
  "manufacturer": "Kino Flo",
  "model": "MIMIK",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-ASTERA-TITAN",
  "category": "lighting",
  "subcategory": "pixel_tube",
  "manufacturer": "Astera",
  "model": "Titan Tube",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-NANLUX-EVOKE",
  "category": "lighting",
  "subcategory": "high_output_LED",
  "manufacturer": "Nanlux",
  "model": "Evoke family",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-NANLITE-FORZA",
  "category": "lighting",
  "subcategory": "COB_LED",
  "manufacturer": "Nanlite",
  "model": "Forza family",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-GODOX-KNOWLED",
  "category": "lighting",
  "subcategory": "cinema_LED",
  "manufacturer": "Godox",
  "model": "KNOWLED family",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-CREAMSOURCE",
  "category": "lighting",
  "subcategory": "LED_panel",
  "manufacturer": "Creamsource",
  "model": "Vortex family",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-PROFOTO-PROD3",
  "category": "lighting",
  "subcategory": "studio_strobe",
  "manufacturer": "Profoto",
  "model": "Pro-D3",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-BRONCOLOR-SCORO",
  "category": "lighting",
  "subcategory": "studio_flash_pack",
  "manufacturer": "Broncolor",
  "model": "Scoro",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-HMI-18K",
  "category": "lighting",
  "subcategory": "HMI",
  "manufacturer": "Various",
  "model": "18K HMI class",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-TUNGSTEN-5K",
  "category": "lighting",
  "subcategory": "tungsten",
  "manufacturer": "Various",
  "model": "5K Tungsten Fresnel",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-SOURCE4",
  "category": "lighting",
  "subcategory": "ellipsoidal",
  "manufacturer": "ETC",
  "model": "Source Four family",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-SPACELIGHT",
  "category": "lighting",
  "subcategory": "soft_overhead",
  "manufacturer": "Various",
  "model": "Space Light",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-BALLOON",
  "category": "lighting",
  "subcategory": "large_soft",
  "manufacturer": "Various",
  "model": "Balloon Light",
  "capability": {},
  "use_cases": [],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-ARRI-TRINITY2",
  "category": "camera_support",
  "subcategory": "body_stabilizer",
  "manufacturer": "ARRI",
  "model": "TRINITY 2",
  "capability": {},
  "use_cases": [
   "long take",
   "low-to-high"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-ARRI-360EVO",
  "category": "camera_support",
  "subcategory": "remote_head",
  "manufacturer": "ARRI",
  "model": "360 EVO",
  "capability": {},
  "use_cases": [
   "crane",
   "vehicle",
   "continuous roll"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "MOV-MRMC-BOLT",
  "category": "camera_support",
  "subcategory": "motion_control_robot",
  "manufacturer": "MRMC",
  "model": "Bolt family",
  "capability": {},
  "use_cases": [
   "tabletop",
   "VFX",
   "high-speed"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "MOV-AGITO",
  "category": "camera_support",
  "subcategory": "robotic_dolly",
  "manufacturer": "Motion Impossible",
  "model": "AGITO",
  "capability": {},
  "use_cases": [
   "sports",
   "studio",
   "live"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "MOV-HYDRASCOPE",
  "category": "camera_support",
  "subcategory": "telescopic_crane",
  "manufacturer": "Chapman/Leonard",
  "model": "Hydrascope family",
  "capability": {},
  "use_cases": [
   "film",
   "large reveal"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "MOV-FISHER",
  "category": "camera_support",
  "subcategory": "dolly",
  "manufacturer": "Fisher",
  "model": "Studio Dolly family",
  "capability": {},
  "use_cases": [
   "drama",
   "film"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-STEADICAM",
  "category": "camera_support",
  "subcategory": "body_stabilizer",
  "manufacturer": "Tiffen",
  "model": "Steadicam family",
  "capability": {},
  "use_cases": [
   "drama",
   "one take"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-RONIN",
  "category": "camera_support",
  "subcategory": "gimbal",
  "manufacturer": "DJI",
  "model": "Ronin family",
  "capability": {},
  "use_cases": [
   "gimbal",
   "vehicle"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-SLIDER",
  "category": "camera_support",
  "subcategory": "slider",
  "manufacturer": "Various",
  "model": "Motorized Slider",
  "capability": {},
  "use_cases": [
   "product",
   "interview"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-CABLECAM",
  "category": "camera_support",
  "subcategory": "cablecam",
  "manufacturer": "Various",
  "model": "Cable Camera System",
  "capability": {},
  "use_cases": [
   "stadium",
   "forest"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "MOV-SPIDERCAM",
  "category": "camera_support",
  "subcategory": "multi_cable_camera",
  "manufacturer": "Spidercam",
  "model": "Spidercam",
  "capability": {},
  "use_cases": [
   "stadium",
   "live"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "MOV-RAILCAM",
  "category": "camera_support",
  "subcategory": "railcam",
  "manufacturer": "Various",
  "model": "Rail Camera",
  "capability": {},
  "use_cases": [
   "sports",
   "concert"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "DRN-DJI-INSPIRE3",
  "category": "aerial",
  "subcategory": "cinema_drone",
  "manufacturer": "DJI",
  "model": "Inspire 3",
  "capability": {
   "full_frame_8K_camera": true,
   "RTK": true,
   "high_frame_rate": true
  },
  "use_cases": [
   "film aerial",
   "VFX plate",
   "commercial"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "DRN-FREEFLY-ALTAX",
  "category": "aerial",
  "subcategory": "heavy_lift",
  "manufacturer": "Freefly",
  "model": "Alta X",
  "capability": {
   "max_payload_kg": 15.06,
   "max_gross_takeoff_kg": 34.86,
   "typical_empty_kg": 10.86,
   "ingress": "IP43 equivalent tested"
  },
  "use_cases": [
   "heavy cinema payload",
   "LiDAR",
   "custom sensor"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "DRN-AVATA2",
  "category": "aerial",
  "subcategory": "FPV_cinewhoop",
  "manufacturer": "DJI/Various",
  "model": "DJI Avata 2",
  "capability": {},
  "use_cases": [
   "proximity",
   "interior transition"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "DRN-FPV5",
  "category": "aerial",
  "subcategory": "FPV",
  "manufacturer": "DJI/Various",
  "model": "Custom 5-inch FPV",
  "capability": {},
  "use_cases": [
   "chase",
   "action"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "DRN-FPV7",
  "category": "aerial",
  "subcategory": "long_range_FPV",
  "manufacturer": "DJI/Various",
  "model": "Custom 7-inch FPV",
  "capability": {},
  "use_cases": [
   "mountain",
   "vehicle"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "DRN-MICRO",
  "category": "aerial",
  "subcategory": "micro_FPV",
  "manufacturer": "DJI/Various",
  "model": "Micro Cinewhoop",
  "capability": {},
  "use_cases": [
   "tight interior"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "SFX-RE5",
  "category": "special_effects",
  "subcategory": "wind_machine",
  "manufacturer": "Reel EFX",
  "model": "RE5 Fan",
  "capability": {},
  "use_cases": [
   "wind",
   "hair",
   "wardrobe"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-RE2",
  "category": "special_effects",
  "subcategory": "wind_machine",
  "manufacturer": "Reel EFX",
  "model": "RE2 Fan",
  "capability": {},
  "use_cases": [
   "wind",
   "smoke shaping"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-DF50",
  "category": "special_effects",
  "subcategory": "hazer",
  "manufacturer": "Reel EFX",
  "model": "DF-50 Diffusion Hazer",
  "capability": {},
  "use_cases": [
   "film haze"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-RADIANCE",
  "category": "special_effects",
  "subcategory": "hazer",
  "manufacturer": "Ultratec",
  "model": "Radiance Hazer",
  "capability": {},
  "use_cases": [
   "haze",
   "stage"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-G3000",
  "category": "special_effects",
  "subcategory": "fogger",
  "manufacturer": "Ultratec",
  "model": "G3000 Fog Generator",
  "capability": {},
  "use_cases": [
   "fog",
   "atmosphere"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-ECLIPSE",
  "category": "special_effects",
  "subcategory": "low_fog",
  "manufacturer": "Ultratec",
  "model": "Eclipse Low Fog Generator",
  "capability": {},
  "use_cases": [
   "ground fog"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-POLARVORTEX",
  "category": "special_effects",
  "subcategory": "snow_machine",
  "manufacturer": "Ultratec",
  "model": "Polar Vortex Snow Machine",
  "capability": {},
  "use_cases": [
   "snow"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-SNOWSQUALL",
  "category": "special_effects",
  "subcategory": "snow_machine",
  "manufacturer": "Ultratec",
  "model": "Snow Squall Snow Machine",
  "capability": {},
  "use_cases": [
   "snow",
   "blizzard"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-RAINBAR",
  "category": "special_effects",
  "subcategory": "rain_rig",
  "manufacturer": "Various",
  "model": "Rain Bar",
  "capability": {},
  "use_cases": [
   "rain close coverage"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-RAINTOWER",
  "category": "special_effects",
  "subcategory": "rain_rig",
  "manufacturer": "Various",
  "model": "Rain Tower",
  "capability": {},
  "use_cases": [
   "large exterior rain"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-RAINGRID",
  "category": "special_effects",
  "subcategory": "rain_rig",
  "manufacturer": "Various",
  "model": "Overhead Rain Grid",
  "capability": {},
  "use_cases": [
   "stage rain"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-WETDOWN",
  "category": "special_effects",
  "subcategory": "water_effect",
  "manufacturer": "Various",
  "model": "Wet-down System",
  "capability": {},
  "use_cases": [
   "night street"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-WATERDUMP",
  "category": "special_effects",
  "subcategory": "water_effect",
  "manufacturer": "Professional SFX vendor",
  "model": "Water Dump / Wave System",
  "capability": {},
  "use_cases": [
   "large splash",
   "wave"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-WATERCANNON",
  "category": "special_effects",
  "subcategory": "water_effect",
  "manufacturer": "Professional SFX vendor",
  "model": "Production Water Cannon class",
  "capability": {},
  "use_cases": [
   "storm",
   "large water"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-FOGCURTAIN",
  "category": "special_effects",
  "subcategory": "fog_effect",
  "manufacturer": "Various",
  "model": "Fog Curtain",
  "capability": {},
  "use_cases": [
   "localized fog wall"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-STEAM",
  "category": "special_effects",
  "subcategory": "steam",
  "manufacturer": "Various",
  "model": "Production Steam System",
  "capability": {},
  "use_cases": [
   "food",
   "industrial"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-AIRMOVER",
  "category": "special_effects",
  "subcategory": "wind_machine",
  "manufacturer": "Various",
  "model": "High-output Air Mover",
  "capability": {},
  "use_cases": [
   "storm",
   "debris"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-MULTIFAN",
  "category": "special_effects",
  "subcategory": "wind_machine",
  "manufacturer": "Various",
  "model": "DMX Multi-Fan Array",
  "capability": {},
  "use_cases": [
   "distributed wind"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-TURNTABLE",
  "category": "special_effects",
  "subcategory": "mechanical",
  "manufacturer": "Various",
  "model": "Large Motion Turntable",
  "capability": {},
  "use_cases": [
   "product",
   "vehicle",
   "set"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-SHAKER",
  "category": "special_effects",
  "subcategory": "mechanical",
  "manufacturer": "Professional SFX vendor",
  "model": "Set Shaker / Vibration Platform",
  "capability": {},
  "use_cases": [
   "earthquake",
   "vehicle interior"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-TILTSET",
  "category": "special_effects",
  "subcategory": "mechanical",
  "manufacturer": "Professional SFX vendor",
  "model": "Tilting Set Platform",
  "capability": {},
  "use_cases": [
   "ship",
   "disaster"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-ROTATINGROOM",
  "category": "special_effects",
  "subcategory": "mechanical",
  "manufacturer": "Professional SFX vendor",
  "model": "Rotating Room / Set",
  "capability": {},
  "use_cases": [
   "fantasy",
   "action"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-WINCH",
  "category": "special_effects",
  "subcategory": "flying_rigging",
  "manufacturer": "Professional rigging/SFX vendor",
  "model": "Computer-Controlled FX Winch",
  "capability": {},
  "use_cases": [
   "object pull",
   "flying interface"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-BREAKGLASS",
  "category": "special_effects",
  "subcategory": "breakaway",
  "manufacturer": "Professional props/SFX vendor",
  "model": "Approved Breakaway Glass System",
  "capability": {},
  "use_cases": [
   "action",
   "stunt"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-BREAKWALL",
  "category": "special_effects",
  "subcategory": "breakaway",
  "manufacturer": "Professional scenic/SFX vendor",
  "model": "Breakaway Wall System",
  "capability": {},
  "use_cases": [
   "action",
   "comedy"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-FLAME",
  "category": "special_effects",
  "subcategory": "fire",
  "manufacturer": "Licensed SFX vendor",
  "model": "Controlled Practical Flame System",
  "capability": {},
  "use_cases": [
   "film fire",
   "interactive light"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-PYRO",
  "category": "special_effects",
  "subcategory": "pyrotechnics",
  "manufacturer": "Licensed Pyrotechnics Provider",
  "model": "Cinematic Pyrotechnic Effects",
  "capability": {},
  "use_cases": [
   "explosion representation",
   "impact",
   "fireball"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-IMPACT",
  "category": "special_effects",
  "subcategory": "impact_effect",
  "manufacturer": "Professional SFX vendor",
  "model": "Impact / Bullet-Hit Representation System",
  "capability": {},
  "use_cases": [
   "drama",
   "action"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "SFX-DUST",
  "category": "special_effects",
  "subcategory": "particle",
  "manufacturer": "Various",
  "model": "Controlled Dust / Particle System",
  "capability": {},
  "use_cases": [
   "impact",
   "collapse"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-EMBERS",
  "category": "special_effects",
  "subcategory": "particle",
  "manufacturer": "Professional SFX vendor",
  "model": "Controlled Ember Visual System",
  "capability": {},
  "use_cases": [
   "fire scene",
   "fantasy"
  ],
  "safety_class": "C",
  "specialist_only": true
 },
 {
  "id": "MOD-8X8",
  "category": "modifier_support",
  "subcategory": "diffusion",
  "manufacturer": "Various",
  "model": "8x8 Half Grid Diffusion",
  "capability": {},
  "use_cases": [
   "portrait",
   "day exterior"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOD-12X12",
  "category": "modifier_support",
  "subcategory": "diffusion",
  "manufacturer": "Various",
  "model": "12x12 Full Grid Diffusion",
  "capability": {},
  "use_cases": [
   "film exterior"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOD-ULTRABOUNCE",
  "category": "modifier_support",
  "subcategory": "bounce",
  "manufacturer": "Various",
  "model": "Ultrabounce",
  "capability": {},
  "use_cases": [
   "exterior fill"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOD-MUSLIN",
  "category": "modifier_support",
  "subcategory": "bounce_diffusion",
  "manufacturer": "Various",
  "model": "Bleached/Unbleached Muslin",
  "capability": {},
  "use_cases": [
   "portrait",
   "drama"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOD-SOLID",
  "category": "modifier_support",
  "subcategory": "negative_fill",
  "manufacturer": "Various",
  "model": "Solid / Floppy",
  "capability": {},
  "use_cases": [
   "contrast",
   "flagging"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOD-NET",
  "category": "modifier_support",
  "subcategory": "light_control",
  "manufacturer": "Various",
  "model": "Single/Double Net",
  "capability": {},
  "use_cases": [
   "exposure shaping"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOD-CPL",
  "category": "modifier_support",
  "subcategory": "filter",
  "manufacturer": "Various",
  "model": "Circular Polarizer",
  "capability": {},
  "use_cases": [
   "glass",
   "water",
   "car"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOD-DIFF",
  "category": "modifier_support",
  "subcategory": "camera_filter",
  "manufacturer": "Various",
  "model": "Diffusion Filter family",
  "capability": {},
  "use_cases": [
   "beauty",
   "period"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "STL-COLUMN",
  "category": "modifier_support",
  "subcategory": "still_support",
  "manufacturer": "Various",
  "model": "Studio Camera Column Stand",
  "capability": {},
  "use_cases": [
   "product still"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "STL-FOCUSRAIL",
  "category": "modifier_support",
  "subcategory": "still_support",
  "manufacturer": "Various",
  "model": "Motorized Macro Focus Rail",
  "capability": {},
  "use_cases": [
   "focus stacking"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-ARRI-ALEXA-MINI-LF",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "ARRI",
  "model": "ALEXA Mini LF",
  "capability": {
   "sensor_class": "large_format"
  },
  "use_cases": [
   "feature",
   "drama",
   "gimbal"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-SONY-BURANO",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "Sony",
  "model": "BURANO",
  "capability": {
   "sensor_class": "full_frame",
   "IBIS": true
  },
  "use_cases": [
   "documentary",
   "drama",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-CANON-C500II",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "Canon",
  "model": "EOS C500 Mark II",
  "capability": {
   "sensor_class": "full_frame"
  },
  "use_cases": [
   "drama",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-PANASONIC-AU-EVA1",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "Panasonic",
  "model": "AU-EVA1",
  "capability": {
   "sensor_class": "Super35"
  },
  "use_cases": [
   "documentary",
   "legacy rental"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "CAM-ARRI-AMIRA",
  "category": "camera",
  "subcategory": "cinema",
  "manufacturer": "ARRI",
  "model": "AMIRA",
  "capability": {
   "sensor_class": "Super35"
  },
  "use_cases": [
   "documentary",
   "live",
   "drama"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-ARRI-MASTER-PRIME",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "ARRI/ZEISS",
  "model": "Master Prime",
  "capability": {},
  "use_cases": [
   "film",
   "drama",
   "VFX"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-COOKE-S4",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "Cooke",
  "model": "S4/i",
  "capability": {},
  "use_cases": [
   "film",
   "period",
   "drama"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-ZEISS-CP3",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "ZEISS",
  "model": "CP.3",
  "capability": {},
  "use_cases": [
   "commercial",
   "documentary"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-DZO-VESPID",
  "category": "lens",
  "subcategory": "prime",
  "manufacturer": "DZOFilm",
  "model": "Vespid Prime",
  "capability": {},
  "use_cases": [
   "commercial",
   "indie film"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-FUJINON-PREMISTA",
  "category": "lens",
  "subcategory": "cinema_zoom",
  "manufacturer": "Fujinon",
  "model": "Premista",
  "capability": {},
  "use_cases": [
   "film",
   "commercial"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LEN-FUJINON-CABRIO",
  "category": "lens",
  "subcategory": "servo_zoom",
  "manufacturer": "Fujinon",
  "model": "Cabrio family",
  "capability": {},
  "use_cases": [
   "documentary",
   "live",
   "sports"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-ARRI-SKYPANEL-X21",
  "category": "lighting",
  "subcategory": "LED_panel",
  "manufacturer": "ARRI",
  "model": "SkyPanel X21",
  "capability": {
   "power_W": 800,
   "pixel_zones": 8,
   "CCT_K": [
    1500,
    20000
   ],
   "IP": "IP66",
   "beam_deg": {
    "hard": 11,
    "soft": 107,
    "open": 121
   },
   "protocols": [
    "DMX512A",
    "RDM",
    "Art-Net 4",
    "sACN",
    "CRMX"
   ]
  },
  "use_cases": [
   "film",
   "VP",
   "weather"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-ARRI-SKYPANEL-X22",
  "category": "lighting",
  "subcategory": "LED_array",
  "manufacturer": "ARRI",
  "model": "SkyPanel X22",
  "capability": {
   "power_W": 1600,
   "pixel_zones": 16,
   "max_lux_10m_5600K": 9600
  },
  "use_cases": [
   "film",
   "large stage",
   "VP"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "LGT-ARRI-SKYPANEL-X23",
  "category": "lighting",
  "subcategory": "LED_array",
  "manufacturer": "ARRI",
  "model": "SkyPanel X23",
  "capability": {
   "power_W": 2400,
   "pixel_zones": 24,
   "max_lux_10m_5600K": 14400
  },
  "use_cases": [
   "large stage",
   "VP",
   "exterior"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "GRP-MATTHEWS-CSTAND",
  "category": "grip",
  "subcategory": "stand",
  "manufacturer": "Matthews",
  "model": "C-Stand family",
  "capability": {},
  "use_cases": [
   "flags",
   "small lights",
   "grip"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "GRP-AVENGER-COMBO",
  "category": "grip",
  "subcategory": "stand",
  "manufacturer": "Avenger",
  "model": "Combo Stand family",
  "capability": {},
  "use_cases": [
   "larger fixtures",
   "frames"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "GRP-MENACEARM",
  "category": "grip",
  "subcategory": "overhead",
  "manufacturer": "Various",
  "model": "Menace Arm",
  "capability": {},
  "use_cases": [
   "top light",
   "boom source"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-PANTHER-DOLLY",
  "category": "camera_support",
  "subcategory": "dolly",
  "manufacturer": "Panther",
  "model": "Dolly systems",
  "capability": {},
  "use_cases": [
   "film",
   "drama",
   "studio"
  ],
  "safety_class": "A",
  "specialist_only": false
 },
 {
  "id": "MOV-TECHNOCRANE",
  "category": "camera_support",
  "subcategory": "telescopic_crane",
  "manufacturer": "Various",
  "model": "Technocrane class",
  "capability": {},
  "use_cases": [
   "feature",
   "commercial",
   "live"
  ],
  "safety_class": "B",
  "specialist_only": true
 },
 {
  "id": "SFX-RAIN-WAND",
  "category": "special_effects",
  "subcategory": "rain_rig",
  "manufacturer": "Various",
  "model": "Rain Wand",
  "capability": {},
  "use_cases": [
   "close rain",
   "localized rain"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-WINDOW-RAIN",
  "category": "special_effects",
  "subcategory": "rain_rig",
  "manufacturer": "Various",
  "model": "Window Rain System",
  "capability": {},
  "use_cases": [
   "interior dialogue",
   "car window"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-LOWFOG",
  "category": "special_effects",
  "subcategory": "atmosphere",
  "manufacturer": "Various",
  "model": "Low Fog System",
  "capability": {},
  "use_cases": [
   "horror",
   "fantasy",
   "stage"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-FOGGER-HAND",
  "category": "special_effects",
  "subcategory": "atmosphere",
  "manufacturer": "Various",
  "model": "Portable Local Fogger",
  "capability": {},
  "use_cases": [
   "localized smoke",
   "food/industrial"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-SNOW",
  "category": "special_effects",
  "subcategory": "weather",
  "manufacturer": "Various",
  "model": "Production Snow Machine class",
  "capability": {},
  "use_cases": [
   "film snow",
   "blizzard"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-BUBBLE",
  "category": "special_effects",
  "subcategory": "particle",
  "manufacturer": "Various",
  "model": "Bubble Machine",
  "capability": {},
  "use_cases": [
   "fantasy",
   "beauty",
   "live"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-CONFETTI",
  "category": "special_effects",
  "subcategory": "particle",
  "manufacturer": "Various",
  "model": "Confetti System",
  "capability": {},
  "use_cases": [
   "live",
   "celebration"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-RAIN-RECIRC",
  "category": "special_effects",
  "subcategory": "water_system",
  "manufacturer": "Various",
  "model": "Recirculating Stage Rain System",
  "capability": {},
  "use_cases": [
   "stage rain",
   "long takes"
  ],
  "safety_class": "B",
  "specialist_only": false
 },
 {
  "id": "SFX-CREATURE",
  "category": "special_effects",
  "subcategory": "mechanical_prop",
  "manufacturer": "Various",
  "model": "Animatronic / Mechanical Creature class",
  "capability": {},
  "use_cases": [
   "feature",
   "creature",
   "practical"
  ],
  "safety_class": "C",
  "specialist_only": true
 }
];

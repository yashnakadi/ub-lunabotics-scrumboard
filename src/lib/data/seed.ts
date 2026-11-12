/**
 * Mock seed data for the frontend prototype.
 *
 * Everything here is fictional. People, emails (reserved ".test" domain), and
 * records exist only to demonstrate the UI. A real backend replaces this file.
 */

import { toDateKey } from "@/lib/format";
import type {
  InventoryItem,
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  Team,
  TeamId,
  User,
} from "@/types";

export const TEAMS: Team[] = [
  {
    id: "software",
    name: "Software",
    prefix: "SW",
    description: "Autonomy, perception, teleoperation, and simulation.",
  },
  {
    id: "electrical",
    name: "Electrical",
    prefix: "EL",
    description: "Power distribution, wiring, motor control, and safety circuits.",
  },
  {
    id: "mechanical",
    name: "Mechanical",
    prefix: "ME",
    description: "Chassis, drivetrain, excavation, and deposition systems.",
  },
];

export const USERS: User[] = [
  {
    id: "u_priya",
    name: "Priya Raman",
    email: "priya.raman@ublunabotics.test",
    role: "admin",
    teamIds: ["software"],
    initials: "PR",
    title: "Project Lead",
  },
  {
    id: "u_marcus",
    name: "Marcus Bell",
    email: "marcus.bell@ublunabotics.test",
    role: "admin",
    teamIds: ["mechanical"],
    initials: "MB",
    title: "Chief Engineer",
  },
  {
    id: "u_ethan",
    name: "Ethan Kowalski",
    email: "ethan.kowalski@ublunabotics.test",
    role: "member",
    teamIds: ["software"],
    initials: "EK",
    title: "Autonomy",
  },
  {
    id: "u_sofia",
    name: "Sofia Alvarez",
    email: "sofia.alvarez@ublunabotics.test",
    role: "member",
    teamIds: ["software", "electrical"],
    initials: "SA",
    title: "Perception & Embedded",
  },
  {
    id: "u_jamal",
    name: "Jamal Okafor",
    email: "jamal.okafor@ublunabotics.test",
    role: "member",
    teamIds: ["electrical"],
    initials: "JO",
    title: "Power Systems",
  },
  {
    id: "u_hannah",
    name: "Hannah Lindqvist",
    email: "hannah.lindqvist@ublunabotics.test",
    role: "member",
    teamIds: ["mechanical"],
    initials: "HL",
    title: "Excavation",
  },
  {
    id: "u_diego",
    name: "Diego Santos",
    email: "diego.santos@ublunabotics.test",
    role: "member",
    teamIds: ["mechanical", "electrical"],
    initials: "DS",
    title: "Drivetrain & Harnessing",
  },
  {
    id: "u_mei",
    name: "Mei Tanaka",
    email: "mei.tanaka@ublunabotics.test",
    role: "member",
    teamIds: ["software", "electrical", "mechanical"],
    initials: "MT",
    title: "Systems Integration",
  },
  {
    id: "u_noah",
    name: "Noah Friedman",
    email: "noah.friedman@ublunabotics.test",
    role: "member",
    teamIds: ["mechanical"],
    initials: "NF",
    title: "Deposition",
  },
];

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

function dayOffset(days: number): Date {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

interface SeedTask {
  team: TeamId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  /** Due date as days from today (negative = past). */
  due: number | null;
  /** Created this many days ago. */
  age: number;
  createdBy?: string;
  tags?: string[];
  checklist?: [label: string, done: boolean][];
  comments?: [author: string, body: string, daysAgo: number][];
}

const SEED_TASKS: SeedTask[] = [
  // Software
  {
    team: "software",
    title: "Integrate Nav2 stack with rover base controller",
    description:
      "Bring up Nav2 on the Jetson and connect it to the differential-drive base controller. The rover should accept goal poses and plan around static obstacles in the simulated arena before we test on hardware.",
    status: "in_progress",
    priority: "high",
    assignee: "u_ethan",
    due: 3,
    age: 12,
    tags: ["autonomy", "ros2"],
    checklist: [
      ["Configure global and local costmap layers", true],
      ["Tune DWB controller parameters", true],
      ["Validate goal-to-goal runs in Gazebo arena", false],
      ["Record a bag file for review", false],
    ],
    comments: [
      ["u_ethan", "Costmaps are publishing. Local planner oscillates near the berm zone, tuning next.", 2],
      ["u_priya", "Try lowering the inflation radius to 0.35 m. The arena is tighter than the sim default.", 1],
    ],
  },
  {
    team: "software",
    title: "LiDAR obstacle detection node",
    description:
      "ROS 2 node that segments rocks and craters from the RPLIDAR scan and publishes them as obstacles for the costmap. Needs to hold 10 Hz on the Orin Nano.",
    status: "in_review",
    priority: "high",
    assignee: "u_sofia",
    due: 1,
    age: 15,
    tags: ["perception"],
    checklist: [
      ["Ground-plane filtering", true],
      ["Cluster extraction", true],
      ["Unit tests with recorded scans", true],
      ["Review by autonomy lead", false],
    ],
    comments: [
      ["u_sofia", "PR is up. Averaging 14 Hz on the Orin with the 0.05 m voxel size.", 1],
    ],
  },
  {
    team: "software",
    title: "AprilTag localization for the starting zone",
    description:
      "Use the fixed AprilTags on the arena wall to initialize the rover pose at the start of each run, then fuse with wheel odometry and IMU through the EKF.",
    status: "todo",
    priority: "medium",
    assignee: "u_mei",
    due: 9,
    age: 6,
    tags: ["localization"],
    checklist: [
      ["Calibrate the mast camera intrinsics", false],
      ["Publish tag detections to tf", false],
      ["Add tag pose as an EKF input", false],
    ],
  },
  {
    team: "software",
    title: "Teleop dashboard: bandwidth usage widget",
    description:
      "Show live uplink/downlink bandwidth in the operator dashboard so drivers can stay under the competition data budget.",
    status: "todo",
    priority: "low",
    assignee: "u_ethan",
    due: 16,
    age: 4,
    tags: ["ui", "comms"],
  },
  {
    team: "software",
    title: "Excavation autonomy state machine",
    description:
      "Implement the dig → travel → dump cycle as a behavior tree. Must handle stall detection on the excavator and fall back to teleop cleanly.",
    status: "in_progress",
    priority: "urgent",
    assignee: "u_priya",
    due: -2,
    age: 20,
    tags: ["autonomy"],
    checklist: [
      ["Define states and transitions", true],
      ["Stall detection from motor current", false],
      ["Teleop takeover path", false],
    ],
    comments: [
      ["u_priya", "Blocked on current telemetry from the motor controllers (EL-005).", 1],
    ],
  },
  {
    team: "software",
    title: "Camera stream compression under 4 Mbps",
    description:
      "Evaluate H.265 hardware encoding on the Orin for the two drive cameras. Target is a usable 720p feed for both cameras within 4 Mbps total.",
    status: "todo",
    priority: "high",
    assignee: null,
    due: 12,
    age: 3,
    tags: ["comms", "video"],
  },
  {
    team: "software",
    title: "Set up CI for the ROS 2 workspace",
    description:
      "GitHub Actions workflow that builds the workspace with colcon and runs linters and unit tests on every pull request.",
    status: "done",
    priority: "medium",
    assignee: "u_ethan",
    due: -10,
    age: 30,
    tags: ["infrastructure"],
    checklist: [
      ["colcon build job", true],
      ["ament lint job", true],
      ["Cache rosdep installs", true],
    ],
  },
  {
    team: "software",
    title: "Jetson Orin Nano image with ROS 2 Humble",
    description:
      "Reproducible setup script for the onboard computer: JetPack, ROS 2 Humble, udev rules for sensors, and the team workspace.",
    status: "done",
    priority: "high",
    assignee: "u_sofia",
    due: -6,
    age: 25,
    tags: ["infrastructure"],
  },

  // Electrical
  {
    team: "electrical",
    title: "Power distribution board rev B layout",
    description:
      "Revise the PDB layout to add per-channel fusing and a dedicated 5 V rail for the compute stack. Rev A ran hot at the drivetrain connector.",
    status: "in_progress",
    priority: "urgent",
    assignee: "u_jamal",
    due: 2,
    age: 14,
    tags: ["pcb", "power"],
    checklist: [
      ["Update schematic with fuse holders", true],
      ["Widen drivetrain traces to 40 A rating", true],
      ["Design rule check", false],
      ["Send gerbers for fabrication", false],
    ],
    comments: [
      ["u_jamal", "Schematic is done. Routing the high-current side now.", 2],
    ],
  },
  {
    team: "electrical",
    title: "CAN bus wiring harness for drivetrain",
    description:
      "Build the harness that daisy-chains the four drive motor controllers, including termination resistors and strain relief at the chassis pass-through.",
    status: "todo",
    priority: "high",
    assignee: "u_diego",
    due: 6,
    age: 7,
    tags: ["harness", "can"],
    checklist: [
      ["Cut and label wire runs", false],
      ["Crimp connectors", false],
      ["Continuity and termination check", false],
    ],
  },
  {
    team: "electrical",
    title: "Emergency stop circuit validation",
    description:
      "Verify the E-stop cuts power to all actuators while keeping the compute stack alive, per the competition safety rules. Document results for the systems engineering paper.",
    status: "in_review",
    priority: "urgent",
    assignee: "u_jamal",
    due: 0,
    age: 9,
    tags: ["safety"],
    checklist: [
      ["Bench test with a dummy load", true],
      ["Test on rover with wheels off the ground", true],
      ["Write up the test report", false],
    ],
    comments: [
      ["u_marcus", "Please attach scope captures of the contactor drop-out time to the report.", 1],
    ],
  },
  {
    team: "electrical",
    title: "Battery management system telemetry",
    description:
      "Read pack voltage, current, and cell temperatures from the BMS over UART and publish them as a ROS 2 topic for the operator dashboard.",
    status: "todo",
    priority: "medium",
    // Assigned across teams: Ethan is on Software only.
    assignee: "u_ethan",
    due: 14,
    age: 5,
    tags: ["power", "telemetry"],
  },
  {
    team: "electrical",
    title: "Motor controller current limit tuning",
    description:
      "Set current limits on the drive and excavation controllers so a stalled motor cannot trip the main fuse. Expose measured current over CAN.",
    status: "in_progress",
    priority: "medium",
    assignee: "u_mei",
    due: -1,
    age: 11,
    tags: ["motor-control"],
    checklist: [
      ["Drive motors", true],
      ["Excavator motor", false],
      ["Publish current over CAN", false],
    ],
  },
  {
    team: "electrical",
    title: "Order connectors and crimp terminals",
    description:
      "Restock Anderson Powerpole housings, XT60 pairs, and ferrules ahead of harness assembly.",
    status: "done",
    priority: "low",
    assignee: "u_jamal",
    due: -8,
    age: 18,
    tags: ["procurement"],
  },
  {
    team: "electrical",
    title: "Update the power budget spreadsheet",
    description:
      "Refresh worst-case and nominal draw for every subsystem with the new excavator motor and confirm battery runtime for a full competition run.",
    status: "done",
    priority: "medium",
    assignee: "u_diego",
    due: -4,
    age: 16,
    tags: ["power"],
  },

  // Mechanical
  {
    team: "mechanical",
    title: "Bucket drum excavator prototype",
    description:
      "Fabricate and assemble the first bucket drum prototype and test it in the regolith simulant bin. Measure fill rate and motor torque.",
    status: "in_progress",
    priority: "high",
    assignee: "u_hannah",
    due: 5,
    age: 13,
    tags: ["excavation"],
    checklist: [
      ["Waterjet the drum end plates", true],
      ["Bend and rivet scoops", true],
      ["Assemble with drive shaft", false],
      ["Dig test in simulant bin", false],
    ],
    comments: [
      ["u_hannah", "End plates are back from the waterjet. Scoops are riveted on two of four.", 1],
    ],
  },
  {
    team: "mechanical",
    title: "Drivetrain gearbox assembly",
    description:
      "Assemble all four planetary gearboxes, apply grease, and check backlash before mounting to the chassis.",
    status: "in_review",
    priority: "high",
    assignee: "u_noah",
    due: 2,
    age: 10,
    tags: ["drivetrain"],
    checklist: [
      ["Assemble gearboxes 1–4", true],
      ["Backlash measurement", true],
      ["Inspection sign-off", false],
    ],
  },
  {
    team: "mechanical",
    title: "Wheel grouser design for regolith simulant",
    description:
      "Compare straight and chevron grouser patterns for traction on BP-1 simulant. Print test wheels and run drawbar pull tests.",
    status: "todo",
    priority: "medium",
    assignee: "u_diego",
    due: 10,
    age: 6,
    tags: ["mobility"],
  },
  {
    team: "mechanical",
    title: "Chassis frame weld inspection",
    description:
      "Inspect all structural welds on the main frame after the last drive test and flag anything that needs rework.",
    status: "todo",
    priority: "high",
    assignee: "u_marcus",
    due: 4,
    age: 3,
    tags: ["chassis", "safety"],
  },
  {
    team: "mechanical",
    title: "Dump bed actuator mount redesign",
    description:
      "The current mount flexes under a full load. Redesign the bracket in 6 mm aluminum and re-run the FEA.",
    status: "in_progress",
    priority: "medium",
    assignee: "u_noah",
    due: -3,
    age: 17,
    tags: ["deposition"],
    checklist: [
      ["Update CAD model", true],
      ["FEA at 1.5× load", false],
      ["Machine the new bracket", false],
    ],
    comments: [
      ["u_noah", "CAD is updated. Waiting on machine shop time for the bracket.", 3],
    ],
  },
  {
    team: "mechanical",
    title: "Dust shielding for the electronics bay",
    description:
      "Design gaskets and a removable cover so fine simulant dust cannot reach the PDB and compute stack.",
    status: "todo",
    priority: "low",
    assignee: "u_hannah",
    due: 20,
    age: 2,
    tags: ["dust-mitigation"],
  },
  {
    team: "mechanical",
    title: "Mass budget audit against the 80 kg limit",
    description:
      "Weigh every subsystem and update the mass budget. Identify where to cut if the rover is over the limit.",
    status: "done",
    priority: "urgent",
    assignee: "u_hannah",
    due: -5,
    age: 21,
    tags: ["systems"],
    checklist: [
      ["Weigh subsystems", true],
      ["Update mass budget sheet", true],
    ],
  },
  {
    team: "mechanical",
    title: "CAD: sensor mast for LiDAR and cameras",
    description:
      "Design a rigid mast that places the LiDAR above the excavator's swept volume and gives both cameras a clear forward view.",
    status: "done",
    priority: "medium",
    assignee: "u_mei",
    due: -12,
    age: 28,
    tags: ["cad"],
  },
];

export function buildSeedTasks(): Task[] {
  const counters: Record<TeamId, number> = {
    software: 0,
    electrical: 0,
    mechanical: 0,
  };

  return SEED_TASKS.map((seed, index) => {
    const team = TEAMS.find((t) => t.id === seed.team)!;
    counters[seed.team] += 1;
    const id = `t_${String(index + 1).padStart(3, "0")}`;
    const createdAt = dayOffset(-seed.age).toISOString();

    const comments: TaskComment[] = (seed.comments ?? []).map(
      ([authorId, body, daysAgo], i) => ({
        id: `${id}_c${i + 1}`,
        taskId: id,
        authorId,
        body,
        createdAt: dayOffset(-daysAgo).toISOString(),
        kind: "comment",
      }),
    );

    return {
      id,
      key: `${team.prefix}-${String(counters[seed.team]).padStart(3, "0")}`,
      title: seed.title,
      description: seed.description,
      status: seed.status,
      priority: seed.priority,
      teamId: seed.team,
      assigneeId: seed.assignee,
      dueDate: seed.due === null ? null : toDateKey(dayOffset(seed.due)),
      createdById: seed.createdBy ?? (seed.team === "mechanical" ? "u_marcus" : "u_priya"),
      createdAt,
      updatedAt: comments.at(-1)?.createdAt ?? createdAt,
      tags: seed.tags ?? [],
      checklist: (seed.checklist ?? []).map(([label, done], i) => ({
        id: `${id}_k${i + 1}`,
        label,
        done,
      })),
      comments,
      order: index,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                  */
/* -------------------------------------------------------------------------- */

type SeedItem = Omit<InventoryItem, "id" | "updatedAt"> & { updatedDaysAgo: number };

const SEED_INVENTORY: SeedItem[] = [
  {
    name: "NVIDIA Jetson Orin Nano Developer Kit",
    category: "Computing",
    description: "Primary onboard computer for autonomy and perception (8 GB).",
    quantity: 2,
    lowStockThreshold: 1,
    location: "Lab · Electronics Cabinet A",
    condition: "Good",
    teamId: "software",
    updatedDaysAgo: 4,
    notes: "One unit is mounted on the rover; the spare is flashed with the same image.",
  },
  {
    name: "Raspberry Pi 5 (8 GB)",
    category: "Computing",
    description: "Used for the teleop relay and bench test rigs.",
    quantity: 3,
    lowStockThreshold: 1,
    location: "Lab · Electronics Cabinet A",
    condition: "Good",
    teamId: "software",
    updatedDaysAgo: 12,
  },
  {
    name: "Arduino Mega 2560",
    category: "Computing",
    description: "Microcontroller boards for sensor breakouts and test fixtures.",
    quantity: 4,
    lowStockThreshold: 1,
    location: "Lab · Electronics Cabinet A",
    condition: "Good",
    teamId: "electrical",
    updatedDaysAgo: 40,
  },
  {
    name: "8-Port Gigabit Ethernet Switch",
    category: "Computing",
    description: "Onboard network switch linking compute, cameras, and radio.",
    quantity: 1,
    lowStockThreshold: 0,
    location: "Rover · Electronics Bay",
    condition: "Good",
    teamId: "software",
    updatedDaysAgo: 22,
  },
  {
    name: "RPLIDAR A2M12 LiDAR Sensor",
    category: "Sensors",
    description: "360° 2D laser scanner, 12 m range. Mounted on the sensor mast.",
    quantity: 1,
    lowStockThreshold: 1,
    location: "Rover · Sensor Mast",
    condition: "Good",
    teamId: "software",
    updatedDaysAgo: 9,
    notes: "No spare on hand. Handle with care and keep the lens cap on in the simulant bin.",
  },
  {
    name: "Intel RealSense D435i Depth Camera",
    category: "Sensors",
    description: "Stereo depth camera with IMU for obstacle detection.",
    quantity: 2,
    lowStockThreshold: 1,
    location: "Lab · Electronics Cabinet B",
    condition: "Good",
    teamId: "software",
    updatedDaysAgo: 15,
  },
  {
    name: "BNO055 9-DOF IMU Breakout",
    category: "Sensors",
    description: "Absolute orientation sensor used by the localization EKF.",
    quantity: 3,
    lowStockThreshold: 1,
    location: "Lab · Electronics Cabinet B",
    condition: "New",
    teamId: "electrical",
    updatedDaysAgo: 30,
  },
  {
    name: "50 kg Load Cell with HX711 Amplifier",
    category: "Sensors",
    description: "Measures collected regolith mass in the dump bed.",
    quantity: 4,
    lowStockThreshold: 2,
    location: "Lab · Electronics Cabinet B",
    condition: "New",
    teamId: "mechanical",
    updatedDaysAgo: 6,
  },
  {
    name: "Brushless Motor Controller (CAN, 60 A)",
    category: "Electrical",
    description: "Motor controllers for the drivetrain and excavation motors.",
    quantity: 6,
    lowStockThreshold: 4,
    location: "Lab · Electronics Cabinet C",
    condition: "Good",
    teamId: "electrical",
    updatedDaysAgo: 3,
  },
  {
    name: "24 V Planetary DC Gearmotor",
    category: "Electrical",
    description: "Drive motors, 71:1 planetary reduction.",
    quantity: 4,
    lowStockThreshold: 4,
    location: "Rover · Drivetrain",
    condition: "Good",
    teamId: "mechanical",
    updatedDaysAgo: 10,
    notes: "All four are installed. Order one spare before competition.",
  },
  {
    name: "24 V 20 Ah LiFePO4 Battery Pack",
    category: "Electrical",
    description: "Main rover batteries with integrated BMS.",
    quantity: 2,
    lowStockThreshold: 2,
    location: "Lab · Battery Safe",
    condition: "Good",
    teamId: "electrical",
    updatedDaysAgo: 2,
    notes: "Store at 50–60% charge. Log every charge cycle on the sheet inside the safe.",
  },
  {
    name: "14 AWG Silicone Wire Spool (red/black, 25 ft)",
    category: "Electrical",
    description: "High-strand-count wire for power runs.",
    quantity: 5,
    lowStockThreshold: 2,
    location: "Lab · Shelf B2",
    condition: "New",
    teamId: "electrical",
    updatedDaysAgo: 8,
  },
  {
    name: "Anderson Powerpole Connectors (45 A)",
    category: "Electrical",
    description: "Housings and contacts for power connections. Counted as pairs.",
    quantity: 18,
    lowStockThreshold: 25,
    location: "Lab · Parts Drawer 4",
    condition: "New",
    teamId: "electrical",
    updatedDaysAgo: 8,
    notes: "Reorder placed. See EL-006.",
  },
  {
    name: "XT60 Connector Pairs",
    category: "Electrical",
    description: "Battery-side connectors.",
    quantity: 22,
    lowStockThreshold: 10,
    location: "Lab · Parts Drawer 4",
    condition: "New",
    teamId: "electrical",
    updatedDaysAgo: 8,
  },
  {
    name: "Emergency Stop Button (twist release)",
    category: "Electrical",
    description: "Red mushroom-head E-stop, NC contacts, panel mount.",
    quantity: 3,
    lowStockThreshold: 2,
    location: "Lab · Electronics Cabinet C",
    condition: "Good",
    teamId: "electrical",
    updatedDaysAgo: 19,
  },
  {
    name: "2020 Aluminum Extrusion (1 m)",
    category: "Mechanical",
    description: "T-slot extrusion for the chassis frame and test fixtures.",
    quantity: 24,
    lowStockThreshold: 8,
    location: "Machine Shop · Rack 1",
    condition: "New",
    teamId: "mechanical",
    updatedDaysAgo: 14,
  },
  {
    name: "6204-2RS Sealed Ball Bearings",
    category: "Mechanical",
    description: "Sealed bearings for wheel hubs and the excavator shaft.",
    quantity: 16,
    lowStockThreshold: 8,
    location: "Machine Shop · Bin 14",
    condition: "New",
    teamId: "mechanical",
    updatedDaysAgo: 27,
  },
  {
    name: "12 in Stroke Linear Actuator (12 V)",
    category: "Mechanical",
    description: "Raises the dump bed and the excavator arm.",
    quantity: 2,
    lowStockThreshold: 1,
    location: "Rover · Deposition",
    condition: "Fair",
    teamId: "mechanical",
    updatedDaysAgo: 5,
    notes: "One actuator has a noisy gearbox. Monitor during testing.",
  },
  {
    name: "Digital Multimeter",
    category: "Tools",
    description: "True-RMS multimeter for bench and field diagnostics.",
    quantity: 2,
    lowStockThreshold: 1,
    location: "Lab · Tool Wall",
    condition: "Good",
    teamId: null,
    updatedDaysAgo: 45,
  },
  {
    name: "Soldering Station",
    category: "Tools",
    description: "Temperature-controlled 70 W station with spare tips.",
    quantity: 2,
    lowStockThreshold: 1,
    location: "Lab · Bench 2",
    condition: "Fair",
    teamId: "electrical",
    updatedDaysAgo: 33,
    notes: "Station #2 needs a new tip.",
  },
  {
    name: "Cordless Drill/Driver Kit (20 V)",
    category: "Tools",
    description: "Drill with two batteries and charger.",
    quantity: 1,
    lowStockThreshold: 0,
    location: "Machine Shop · Tool Cabinet",
    condition: "Needs Repair",
    teamId: "mechanical",
    updatedDaysAgo: 7,
    notes: "Chuck slips under load. Repair requested.",
  },
  {
    name: "BP-1 Regolith Simulant (kg)",
    category: "Miscellaneous",
    description: "Lunar regolith simulant for the excavation test bin.",
    quantity: 150,
    lowStockThreshold: 50,
    location: "Test Area · Simulant Bin",
    condition: "Good",
    teamId: null,
    updatedDaysAgo: 20,
    notes: "Respirators are required whenever the bin is open.",
  },
  {
    name: "Safety Glasses",
    category: "Miscellaneous",
    description: "ANSI Z87.1 clear safety glasses.",
    quantity: 9,
    lowStockThreshold: 10,
    location: "Lab · Entry Shelf",
    condition: "Good",
    teamId: null,
    updatedDaysAgo: 11,
  },
];

export function buildSeedInventory(): InventoryItem[] {
  return SEED_INVENTORY.map(({ updatedDaysAgo, ...item }, index) => ({
    ...item,
    id: `INV-${String(index + 1).padStart(4, "0")}`,
    updatedAt: dayOffset(-updatedDaysAgo).toISOString(),
  }));
}

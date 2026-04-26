import { z } from "zod";
import { defineResource, defineListView } from "@/builders";
import { formViewFromZod } from "../_factory/formFromZod";
import { detailViewFromZod } from "../_factory/detailFromZod";
/** Extended Booking resources — Service, Resource (room/asset), Staff,
 *  Availability, Location, PricingTier, Booking waitlist entry. Gives the
 *  plugin full parity with a modern scheduling platform (Calendly-class + OpenTable-class).
 */
const ServiceSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    category: z.string(),
    durationMin: z.number(),
    price: z.number(),
    currency: z.string(),
    active: z.boolean(),
    description: z.string().optional(),
});
const ResourceBookableSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    kind: z.enum(["room", "equipment", "vehicle", "desk", "table"]),
    location: z.string(),
    capacity: z.number(),
    status: z.enum(["available", "in-use", "maintenance", "retired"]),
});
const StaffSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    role: z.string(),
    skills: z.array(z.string()),
    hourlyRate: z.number(),
    active: z.boolean(),
});
const AvailabilityRuleSchema = z.object({
    id: z.string(),
    staffId: z.string(),
    dayOfWeek: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    startTime: z.string(),
    endTime: z.string(),
    timezone: z.string(),
});
const LocationSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    timezone: z.string(),
    active: z.boolean(),
});
const WaitlistSchema = z.object({
    id: z.string(),
    code: z.string(),
    customer: z.string(),
    service: z.string(),
    requestedAt: z.string(),
    desiredWindow: z.string(),
    status: z.enum(["waiting", "offered", "converted", "expired", "cancelled"]),
});
const pick = (arr, i) => arr[i % arr.length];
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const code = (p, i, pad = 4) => `${p}-${String(1000 + i).padStart(pad, "0")}`;
function tagSeed(resource, rows) {
    resource.__seed = [...rows];
    return resource;
}
export const serviceResource = tagSeed(defineResource({
    id: "booking.service",
    singular: "Service",
    plural: "Services",
    schema: ServiceSchema,
    displayField: "name",
    searchable: ["name", "code", "category"],
    icon: "Briefcase",
}), Array.from({ length: 10 }, (_, i) => ({
    id: `svc_${i + 1}`,
    code: code("SVC", i, 4),
    name: pick([
        "Consultation", "Deep clean", "Strategy call", "On-site visit", "Training",
        "Quick tune-up", "Full service", "Emergency call-out", "Quarterly check", "Bespoke work",
    ], i),
    category: pick(["consultation", "cleaning", "training", "maintenance", "custom"], i),
    durationMin: pick([30, 45, 60, 90, 120], i),
    price: 75 + i * 30,
    currency: "USD",
    active: i !== 9,
    description: "",
})));
export const bookingResourceAsset = tagSeed(defineResource({
    id: "booking.resource",
    singular: "Bookable Resource",
    plural: "Bookable Resources",
    schema: ResourceBookableSchema,
    displayField: "name",
    searchable: ["name", "code", "location"],
    icon: "DoorOpen",
}), Array.from({ length: 14 }, (_, i) => ({
    id: `res_${i + 1}`,
    code: code("RES", i, 4),
    name: pick(["Meeting Room A", "Meeting Room B", "Workshop Bay 1", "Workshop Bay 2", "Van #1", "Van #2",
        "Desk 1", "Desk 2", "Table T1", "Projector", "Demo Room", "Lab A", "Lab B", "Studio"], i),
    kind: pick(["room", "equipment", "vehicle", "desk", "table"], i),
    location: pick(["HQ", "HQ", "HQ", "Field Depot", "Downtown", "Field Depot"], i),
    capacity: pick([8, 4, 12, 6, 2, 2, 1, 1, 4, 0, 10, 8, 8, 6], i),
    status: pick(["available", "available", "available", "in-use", "maintenance"], i),
})));
export const staffResource = tagSeed(defineResource({
    id: "booking.staff",
    singular: "Staff Member",
    plural: "Staff",
    schema: StaffSchema,
    displayField: "name",
    searchable: ["name", "role"],
    icon: "UserCircle",
}), Array.from({ length: 8 }, (_, i) => ({
    id: `staff_${i + 1}`,
    code: code("STF", i, 4),
    name: pick(["Sam Hopper", "Alex Knuth", "Taylor Turing", "Jordan Hamilton", "Casey Pappas", "Morgan Liskov", "Riley Perlman", "Dakota Shamir"], i),
    role: pick(["Consultant", "Technician", "Trainer", "Specialist", "Lead"], i),
    skills: pick([
        ["react", "typescript"],
        ["plumbing", "electrical"],
        ["sales", "onboarding"],
        ["cleaning", "setup"],
        ["training", "coaching"],
    ], i),
    hourlyRate: 40 + i * 15,
    active: i !== 7,
})));
export const availabilityRuleResource = tagSeed(defineResource({
    id: "booking.availability-rule",
    singular: "Availability Rule",
    plural: "Availability Rules",
    schema: AvailabilityRuleSchema,
    displayField: "id",
    searchable: ["staffId"],
    icon: "Clock",
}), Array.from({ length: 30 }, (_, i) => {
    const staff = Math.floor(i / 5) + 1;
    return {
        id: `ar_${i + 1}`,
        staffId: `staff_${Math.min(staff, 7)}`,
        dayOfWeek: pick(["mon", "tue", "wed", "thu", "fri"], i % 5),
        startTime: "09:00",
        endTime: "17:00",
        timezone: pick(["America/Los_Angeles", "America/New_York", "Europe/London"], staff),
    };
}));
export const locationResource = tagSeed(defineResource({
    id: "booking.location",
    singular: "Location",
    plural: "Locations",
    schema: LocationSchema,
    displayField: "name",
    searchable: ["name", "city"],
    icon: "MapPin",
}), Array.from({ length: 5 }, (_, i) => ({
    id: `loc_${i + 1}`,
    code: pick(["HQ", "DWN", "FLD", "EU1", "AP1"], i),
    name: pick(["HQ", "Downtown Office", "Field Depot", "London Hub", "Tokyo Hub"], i),
    address: pick(["100 Main St", "200 Market Ave", "300 Industrial Way", "10 Baker St", "1 Chome"], i),
    city: pick(["San Francisco", "San Francisco", "Austin", "London", "Tokyo"], i),
    country: pick(["USA", "USA", "USA", "UK", "JP"], i),
    timezone: pick(["America/Los_Angeles", "America/Los_Angeles", "America/Chicago", "Europe/London", "Asia/Tokyo"], i),
    active: true,
})));
export const waitlistResource = tagSeed(defineResource({
    id: "booking.waitlist",
    singular: "Waitlist Entry",
    plural: "Waitlist",
    schema: WaitlistSchema,
    displayField: "customer",
    searchable: ["customer", "service"],
    icon: "ListOrdered",
}), Array.from({ length: 12 }, (_, i) => ({
    id: `wl_${i + 1}`,
    code: code("WL", i, 5),
    customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper", "Dunder Mifflin"], i),
    service: pick(["Consultation", "Deep clean", "Strategy call", "On-site visit", "Training"], i),
    requestedAt: daysAgo(i * 0.5),
    desiredWindow: pick(["Next week", "Within 48h", "Tomorrow AM", "Anytime this month"], i),
    status: pick(["waiting", "waiting", "offered", "converted", "expired", "cancelled"], i),
})));
export const serviceListView = defineListView({
    id: "booking.services.list",
    title: "Services",
    description: "Bookable services + pricing.",
    resource: "booking.service",
    columns: [
        { field: "code", label: "Code", width: 90 },
        { field: "name", label: "Name", sortable: true },
        { field: "category", label: "Category", kind: "enum" },
        { field: "durationMin", label: "Duration (min)", align: "right", kind: "number", totaling: "avg" },
        { field: "price", label: "Price", align: "right", kind: "currency", totaling: "avg" },
        { field: "active", label: "Active", kind: "boolean" },
    ],
});
export const resourceListView = defineListView({
    id: "booking.resources.list",
    title: "Bookable Resources",
    description: "Rooms, equipment, vehicles, desks.",
    resource: "booking.resource",
    columns: [
        { field: "code", label: "Code", width: 90 },
        { field: "name", label: "Name", sortable: true },
        { field: "kind", label: "Kind", kind: "enum" },
        { field: "location", label: "Location", sortable: true },
        { field: "capacity", label: "Capacity", align: "right", kind: "number" },
        { field: "status", label: "Status", kind: "enum", options: [
                { value: "available", label: "Available", intent: "success" },
                { value: "in-use", label: "In use", intent: "info" },
                { value: "maintenance", label: "Maintenance", intent: "warning" },
                { value: "retired", label: "Retired", intent: "neutral" },
            ] },
    ],
});
export const staffListView = defineListView({
    id: "booking.staff.list",
    title: "Staff",
    description: "Team members offering services.",
    resource: "booking.staff",
    columns: [
        { field: "code", label: "Code", width: 90 },
        { field: "name", label: "Name", sortable: true },
        { field: "role", label: "Role" },
        { field: "hourlyRate", label: "Rate / hr", align: "right", kind: "currency", totaling: "avg" },
        { field: "active", label: "Active", kind: "boolean" },
    ],
});
export const availabilityRuleListView = defineListView({
    id: "booking.availability-rules.list",
    title: "Availability Rules",
    resource: "booking.availability-rule",
    columns: [
        { field: "staffId", label: "Staff" },
        { field: "dayOfWeek", label: "Day", kind: "enum" },
        { field: "startTime", label: "Start" },
        { field: "endTime", label: "End" },
        { field: "timezone", label: "Timezone" },
    ],
});
export const locationListView = defineListView({
    id: "booking.locations.list",
    title: "Locations",
    resource: "booking.location",
    columns: [
        { field: "code", label: "Code", width: 80 },
        { field: "name", label: "Name", sortable: true },
        { field: "city", label: "City" },
        { field: "country", label: "Country", width: 90 },
        { field: "active", label: "Active", kind: "boolean" },
    ],
});
export const waitlistListView = defineListView({
    id: "booking.waitlist.list",
    title: "Waitlist",
    description: "Customers waiting for a slot.",
    resource: "booking.waitlist",
    columns: [
        { field: "code", label: "Code", width: 90 },
        { field: "customer", label: "Customer", sortable: true },
        { field: "service", label: "Service" },
        { field: "desiredWindow", label: "Window" },
        { field: "status", label: "Status", kind: "enum", options: [
                { value: "waiting", label: "Waiting", intent: "warning" },
                { value: "offered", label: "Offered", intent: "info" },
                { value: "converted", label: "Converted", intent: "success" },
                { value: "expired", label: "Expired", intent: "neutral" },
                { value: "cancelled", label: "Cancelled", intent: "danger" },
            ] },
    ],
});
/* ------------------------------------------------------------------------ */
/* Auto-generated Form + Detail views for each resource.                      */
/* Uses the Zod schemas above — no hand-written field lists needed.           */
/* ------------------------------------------------------------------------ */
const serviceFormView = formViewFromZod({
    id: "booking.service.form",
    title: "Service",
    resource: "booking.service",
    schema: ServiceSchema,
    defaults: { active: true, currency: "USD" },
});
const serviceDetailView = detailViewFromZod({
    resource: "booking.service",
    singular: "Service",
    plural: "Services",
    pluginLabel: "Booking",
    path: "/bookings/services",
    icon: "Briefcase",
    schema: ServiceSchema,
    displayField: "name",
});
const resourceAssetFormView = formViewFromZod({
    id: "booking.resource.form",
    title: "Bookable Resource",
    resource: "booking.resource",
    schema: ResourceBookableSchema,
    defaults: { status: "available" },
});
const resourceAssetDetailView = detailViewFromZod({
    resource: "booking.resource",
    singular: "Bookable Resource",
    plural: "Bookable Resources",
    pluginLabel: "Booking",
    path: "/bookings/resources",
    icon: "DoorOpen",
    schema: ResourceBookableSchema,
    displayField: "name",
});
const staffFormView = formViewFromZod({
    id: "booking.staff.form",
    title: "Staff Member",
    resource: "booking.staff",
    schema: StaffSchema,
    defaults: { active: true },
});
const staffDetailView = detailViewFromZod({
    resource: "booking.staff",
    singular: "Staff Member",
    plural: "Staff",
    pluginLabel: "Booking",
    path: "/bookings/staff",
    icon: "UserCircle",
    schema: StaffSchema,
    displayField: "name",
});
const availabilityFormView = formViewFromZod({
    id: "booking.availability-rule.form",
    title: "Availability Rule",
    resource: "booking.availability-rule",
    schema: AvailabilityRuleSchema,
});
const availabilityDetailView = detailViewFromZod({
    resource: "booking.availability-rule",
    singular: "Availability Rule",
    plural: "Availability Rules",
    pluginLabel: "Booking",
    path: "/bookings/availability-rules",
    icon: "Clock",
    schema: AvailabilityRuleSchema,
    displayField: "id",
});
const locationFormView = formViewFromZod({
    id: "booking.location.form",
    title: "Location",
    resource: "booking.location",
    schema: LocationSchema,
    defaults: { active: true },
});
const locationDetailView = detailViewFromZod({
    resource: "booking.location",
    singular: "Location",
    plural: "Locations",
    pluginLabel: "Booking",
    path: "/bookings/locations",
    icon: "MapPin",
    schema: LocationSchema,
    displayField: "name",
});
const waitlistFormView = formViewFromZod({
    id: "booking.waitlist.form",
    title: "Waitlist Entry",
    resource: "booking.waitlist",
    schema: WaitlistSchema,
    defaults: { status: "waiting" },
});
const waitlistDetailView = detailViewFromZod({
    resource: "booking.waitlist",
    singular: "Waitlist Entry",
    plural: "Waitlist",
    pluginLabel: "Booking",
    path: "/bookings/waitlist",
    icon: "ListOrdered",
    schema: WaitlistSchema,
    displayField: "customer",
});
export const BOOKING_EXTENDED_RESOURCES = [
    serviceResource,
    bookingResourceAsset,
    staffResource,
    availabilityRuleResource,
    locationResource,
    waitlistResource,
];
export const BOOKING_EXTENDED_VIEWS = [
    serviceListView,
    serviceFormView,
    serviceDetailView,
    resourceListView,
    resourceAssetFormView,
    resourceAssetDetailView,
    staffListView,
    staffFormView,
    staffDetailView,
    availabilityRuleListView,
    availabilityFormView,
    availabilityDetailView,
    locationListView,
    locationFormView,
    locationDetailView,
    waitlistListView,
    waitlistFormView,
    waitlistDetailView,
];

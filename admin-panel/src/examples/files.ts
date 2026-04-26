import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";

const controlRoomView = buildCompactControlRoom({
  viewId: "files.control-room.view",
  resource: "files.file",
  title: "Files Control Room",
  description: "Storage, uploads, shares.",
  kpis: [
    { label: "Files", resource: "files.file" },
    { label: "Total size (bytes)", resource: "files.file", fn: "sum", field: "sizeBytes" },
    { label: "Uploaded (7d)", resource: "files.file", range: "last-7" },
  ],
  charts: [
    { label: "Files by type", resource: "files.file", chart: "donut", groupBy: "mimeType" },
    { label: "Uploads (30d)", resource: "files.file", chart: "area", period: "day", lastDays: 30 },
  ],
  shortcuts: [
    { label: "Upload", icon: "Upload", href: "/files/new" },
    { label: "Buckets", icon: "HardDrive", href: "/files/buckets" },
  ],
});

export const filesPlugin = buildDomainPlugin({
  id: "files",
  label: "Files",
  icon: "FolderOpen",
  section: SECTIONS.workspace,
  order: 3,
  resources: [
    {
      id: "file",
      singular: "File",
      plural: "Files",
      icon: "File",
      path: "/files",
      defaultSort: { field: "uploadedAt", dir: "desc" },
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "mimeType", label: "Type", kind: "text" },
        { name: "sizeBytes", label: "Size", kind: "number", align: "right", sortable: true },
        { name: "owner", kind: "text", sortable: true },
        // Storage routing — which registered backend holds the bytes + the
        // opaque object key assigned at upload. Persisted so reads route to
        // the same adapter the write used even if the default changes.
        { name: "storageAdapter", label: "Backend", kind: "text" },
        { name: "objectKey", label: "Object Key", kind: "text" },
        { name: "etag", label: "ETag", kind: "text" },
        { name: "sha256", label: "SHA-256", kind: "text" },
        { name: "public", kind: "boolean" },
        { name: "uploadedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 30,
      seed: (i) => ({
        name: pick(["contract.pdf", "photo.jpg", "data.csv", "presentation.pptx", "logo.svg", "report.xlsx"], i),
        mimeType: pick(["application/pdf", "image/jpeg", "text/csv", "application/vnd.ms-powerpoint", "image/svg+xml"], i),
        sizeBytes: 1024 * (100 + ((i * 131) % 9000)),
        owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
        storageAdapter: pick(["default", "r2-cold", "wasabi-archive"], i),
        objectKey: `files/${String(i).slice(0, 2)}/${String(i).padStart(4, "0")}.${pick(["pdf", "jpg", "csv", "pptx", "svg"], i)}`,
        etag: `"${(i * 7919).toString(16).padStart(32, "0")}"`,
        sha256: (i * 2654435761).toString(16).padStart(64, "0"),
        public: i % 5 === 0,
        uploadedAt: daysAgo(i),
      }),
    },
    {
      id: "storage-backend",
      singular: "Storage Backend",
      plural: "Storage Backends",
      icon: "Database",
      path: "/files/storage",
      defaultSort: { field: "label", dir: "asc" },
      fields: [
        { name: "slug", kind: "text", required: true, sortable: true },
        { name: "kind", kind: "text" },
        { name: "label", kind: "text", sortable: true },
        { name: "provider", label: "S3 Provider", kind: "text" },
        { name: "endpoint", kind: "text" },
        { name: "bucket", kind: "text" },
        { name: "region", kind: "text" },
        { name: "isDefault", label: "Default", kind: "boolean" },
        { name: "acceptsWrites", label: "Writes", kind: "boolean" },
      ],
      seedCount: 4,
      seed: (i) => ({
        slug: pick(["default", "r2-cold", "wasabi-archive", "minio-dev"], i),
        kind: pick(["local", "s3", "s3", "s3"], i),
        label: pick(
          ["Local filesystem", "Cloudflare R2 (cold)", "Wasabi archive", "MinIO (dev)"],
          i,
        ),
        provider: pick(["-", "cloudflare-r2", "wasabi", "minio"], i),
        endpoint: pick(
          ["-", "https://acct.r2.cloudflarestorage.com", "https://s3.us-east-1.wasabisys.com", "http://localhost:9000"],
          i,
        ),
        bucket: pick(["-", "acme-cold", "acme-archive", "dev"], i),
        region: pick(["-", "auto", "us-east-1", "us-east-1"], i),
        isDefault: i === 0,
        acceptsWrites: true,
      }),
    },
    {
      id: "bucket",
      singular: "Bucket",
      plural: "Buckets",
      icon: "HardDrive",
      path: "/files/buckets",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "region", kind: "text" },
        { name: "filesCount", kind: "number", align: "right" },
        { name: "totalBytes", kind: "number", align: "right" },
        { name: "adapter", kind: "text" },
      ],
      seedCount: 4,
      seed: (i) => ({
        name: pick(["uploads", "exports", "attachments", "archives"], i),
        region: pick(["us-east-1", "eu-west-1", "ap-northeast-1"], i),
        filesCount: 100 + i * 50,
        totalBytes: 1_000_000_000 + i * 500_000_000,
        adapter: pick(["default", "r2-cold", "wasabi-archive", "minio-dev"], i),
      }),
    },
  ],
  extraNav: [
    { id: "files.control-room.nav", label: "Files Control Room", icon: "LayoutDashboard", path: "/files/control-room", view: "files.control-room.view", order: 0 },
    { id: "files.storage.nav", label: "Storage Backends", icon: "Database", path: "/files/storage", order: 10 },
  ],
  extraViews: [controlRoomView],
  commands: [
    { id: "files.go.control-room", label: "Files: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/files/control-room"; } },
    { id: "files.upload", label: "Upload file", icon: "Upload", run: () => { window.location.hash = "/files/new"; } },
    { id: "files.go.storage", label: "Storage: Backends", icon: "Database", run: () => { window.location.hash = "/files/storage"; } },
  ],
});

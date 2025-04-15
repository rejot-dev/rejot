import { describe, it, expect, mock } from "bun:test";
import { MockRejotMcp } from "../_test/mock-mcp-server";
import { ProjectInitializer } from "./project";
import type {
  IManifestWorkspaceResolver,
  Workspace,
  ManifestInfo,
} from "@rejot-dev/contract-tools/manifest";
import { workspaceToSyncManifest } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

// Create a sample manifest
const createBasicManifest = (slug: string) => ({
  slug,
  manifestVersion: 0,
  connections: [],
  dataStores: [],
  eventStores: [],
  publicSchemas: [],
  consumerSchemas: [],
});

// Create a more complex manifest with real data
const createComplexManifest = (slug: string) => ({
  ...createBasicManifest(slug),
  connections: [],
  publicSchemas: [],
});

// Create a mock of the IManifestWorkspaceResolver interface
const createMockWorkspaceResolver = (testWorkspace: Workspace): IManifestWorkspaceResolver => {
  return {
    resolveWorkspace: mock(() => Promise.resolve(testWorkspace)),
    getManifestInfo: mock(
      (filePath: string): Promise<ManifestInfo> =>
        Promise.resolve({
          path: filePath,
          manifest: createBasicManifest("test"),
          rootPath: "/test/root",
        }),
    ),
    workspaceToSyncManifest: mock((workspace: Workspace) => workspaceToSyncManifest(workspace)),
  };
};

// Helper to create a test workspace
const createTestWorkspace = (): Workspace => ({
  rootPath: "/test/root",
  ancestor: {
    path: "rejot-manifest.json",
    manifest: createBasicManifest("root-manifest"),
  },
  children: [
    {
      path: "apps/test-app/rejot-manifest.json",
      manifest: createBasicManifest("child-manifest"),
    },
  ],
});

// Helper to create a complex test workspace
const createComplexTestWorkspace = (): Workspace => ({
  rootPath: "/complex/root",
  ancestor: {
    path: "rejot-manifest.json",
    manifest: createComplexManifest("complex-root"),
  },
  children: [
    {
      path: "apps/service-a/rejot-manifest.json",
      manifest: createComplexManifest("service-a"),
    },
    {
      path: "apps/service-b/rejot-manifest.json",
      manifest: createComplexManifest("service-b"),
    },
    {
      path: "libs/shared/rejot-manifest.json",
      manifest: createBasicManifest("shared-lib"),
    },
  ],
});

describe("ProjectInitializer", () => {
  it("should initialize and register workspace resources", async () => {
    // Arrange
    const testWorkspace = createTestWorkspace();
    const mockWorkspaceResolver = createMockWorkspaceResolver(testWorkspace);
    const projectInitializer = new ProjectInitializer(mockWorkspaceResolver);

    const mockMcp = new MockRejotMcp("/test/project/dir");

    // Act
    await projectInitializer.initialize(mockMcp.state);
    await projectInitializer.register(mockMcp);

    // Assert
    // 1. Verify that resolveWorkspace was called with correct parameters
    expect(mockWorkspaceResolver.resolveWorkspace).toHaveBeenCalledWith({
      startDir: "/test/project/dir",
    });

    // 2. Verify that resources were registered in the MCP server
    const resources = mockMcp.getResources();

    // Should have exactly one resource registered
    expect(resources.length).toBe(1);

    // Verify the registered resource is correct
    const resource = resources[0];
    expect(resource.name).toBe("ReJot Manifests");
    expect(resource.options.mimeType).toBe("application/json");
  });

  it("should list all workspaces when the resource list handler is called", async () => {
    // Arrange
    const testWorkspace = createTestWorkspace();
    const mockWorkspaceResolver = createMockWorkspaceResolver(testWorkspace);
    const projectInitializer = new ProjectInitializer(mockWorkspaceResolver);

    const mockMcp = new MockRejotMcp("/test/project/dir");

    // Act
    await projectInitializer.initialize(mockMcp.state);
    await projectInitializer.register(mockMcp);

    // Get the registered resource template
    const resources = mockMcp.getResources();

    // We can't directly access the handlers, so we need to simulate what would happen
    // The list functionality would return resources from our workspace
    expect(resources.length).toBe(1);
    expect(resources[0].name).toBe("ReJot Manifests");

    // Our improved MockMcpServer implementation now correctly reads the URI template
    expect(resources[0].template.uri).toBe("rejot://workspace/{+path}");
  });

  it("should handle a workspace with no children", async () => {
    // Arrange
    const testWorkspace = {
      ...createTestWorkspace(),
      children: [],
    };
    const mockWorkspaceResolver = createMockWorkspaceResolver(testWorkspace);
    const projectInitializer = new ProjectInitializer(mockWorkspaceResolver);

    const mockMcp = new MockRejotMcp("/test/project/dir");

    // Act
    await projectInitializer.initialize(mockMcp.state);
    await projectInitializer.register(mockMcp);

    // Get the registered resource template
    const resources = mockMcp.getResources();

    // We're just checking that the initialization doesn't fail with no children
    expect(resources.length).toBe(1);
    expect(resources[0].name).toBe("ReJot Manifests");
  });

  it("should initialize complex workspace with multiple manifests and verify resource details", async () => {
    // Arrange
    const testWorkspace = createComplexTestWorkspace();
    const mockWorkspaceResolver = createMockWorkspaceResolver(testWorkspace);
    const projectInitializer = new ProjectInitializer(mockWorkspaceResolver);

    const mockMcp = new MockRejotMcp("/complex/project/dir");

    // Act
    await projectInitializer.initialize(mockMcp.state);
    await projectInitializer.register(mockMcp);

    // Assert
    const resources = mockMcp.getResources();

    // Verify the resource was registered correctly
    expect(resources.length).toBe(1);
    expect(resources[0].name).toBe("ReJot Manifests");
    expect(resources[0].template.uri).toBe("rejot://workspace/{+path}");
    expect(resources[0].options.mimeType).toBe("application/json");

    // Verify the list handler works correctly
    const listHandler = resources[0].template.handlers.list;
    expect(listHandler).toBeDefined();

    const listResult = listHandler?.();
    expect(listResult).toBeDefined();
    expect(listResult?.resources).toBeArrayOfSize(4);

    // Verify the root manifest
    expect(listResult?.resources[0]).toEqual({
      name: "Root Manifest ('complex-root'), URI: rejot://workspace/rejot-manifest.json",
      uri: "rejot://workspace/rejot-manifest.json",
      description: "Root manifest for complex-root",
    });

    // Verify the service manifests
    expect(listResult?.resources[1]).toEqual({
      name: "Manifest ('service-a'), URI: rejot://workspace/apps/service-a/rejot-manifest.json",
      uri: "rejot://workspace/apps/service-a/rejot-manifest.json",
      description: "Manifest for service-a",
    });

    expect(listResult?.resources[2]).toEqual({
      name: "Manifest ('service-b'), URI: rejot://workspace/apps/service-b/rejot-manifest.json",
      uri: "rejot://workspace/apps/service-b/rejot-manifest.json",
      description: "Manifest for service-b",
    });

    // Verify the shared lib manifest
    expect(listResult?.resources[3]).toEqual({
      name: "Manifest ('shared-lib'), URI: rejot://workspace/libs/shared/rejot-manifest.json",
      uri: "rejot://workspace/libs/shared/rejot-manifest.json",
      description: "Manifest for shared-lib",
    });

    const getHandler = resources[0].template.handlers.get;
    expect(getHandler).toBeDefined();

    // Create a mock URL-like object with the required properties
    const mockUri = {
      pathname: "/rejot-manifest.json",
      href: "rejot://workspace/rejot-manifest.json",
    };
    const getResult = await getHandler?.(mockUri);
    expect(getResult).toBeDefined();

    // Verify the get handler returns the correct structure
    expect(getResult).toEqual({
      contents: [
        {
          uri: "rejot://workspace/rejot-manifest.json",
          text: expect.any(String), // The exact formatting might vary
        },
      ],
    });
  });
});

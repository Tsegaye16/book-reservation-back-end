// Import the Notification model and controller functions to be tested
const Notification = require("../models/Notification");
const {
  createNotification,
  getNotifications,
} = require("../controllers/notificationController");

// Mock the Notification model so we don't actually interact with the database
jest.mock("../models/Notification");

// Main test suite for the Notification Controller
describe("Notification Controller", () => {
  // Declare variables that will be reused across tests
  let req, res;

  // Before each test case, reset all mocks and create fresh request/response objects
  beforeEach(() => {
    jest.clearAllMocks(); // Clear any previous mock implementations and calls
    req = {
      user: {
        id: "userId123", // Mock authenticated user ID
      },
    };
    res = {
      status: jest.fn().mockReturnThis(), // Mock status() to return 'this' for chaining
      json: jest.fn(), // Mock json response method
      send: jest.fn(), // Mock send response method
    };
  });

  // Test suite for createNotification function
  describe("createNotification", () => {
    // Test case: Successful notification creation
    it("should create a new notification", async () => {
      // Test data
      const userId = "userId123";
      const message = "Test notification";
      const type = "test_type";

      // Mock notification object with save method
      const mockNotification = {
        user: userId,
        message,
        type,
        save: jest.fn().mockResolvedValue(true), // Mock successful save
      };

      // Make Notification constructor return our mock
      Notification.mockImplementation(() => mockNotification);

      // Execute the function being tested
      await createNotification(userId, message, type);

      // Assertions:
      // 1. Notification was instantiated with correct data
      expect(Notification).toHaveBeenCalledWith({
        user: userId,
        message,
        type,
      });
      // 2. save() was called on the notification
      expect(mockNotification.save).toHaveBeenCalled();
    });

    // Test case: Error handling during notification creation
    it("should handle errors when creating notification", async () => {
      // Test data
      const userId = "userId123";
      const message = "Test notification";
      const type = "test_type";

      // Mock notification with failing save
      const mockNotification = {
        save: jest.fn().mockRejectedValue(new Error("Database error")),
      };
      Notification.mockImplementation(() => mockNotification);

      // Spy on console.error to verify error logging
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Suppress actual console output

      // Execute the function
      await createNotification(userId, message, type);

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating notification:",
        expect.any(Error)
      );

      // Clean up the spy
      consoleSpy.mockRestore();
    });
  });

  // Test suite for getNotifications function
  describe("getNotifications", () => {
    // Test case: Successful retrieval of notifications
    it("should return notifications for the authenticated user sorted by date", async () => {
      // Mock notification data
      const mockNotifications = [
        {
          _id: "notif1",
          message: "Notification 1",
          createdAt: new Date("2023-01-02"), // Newer date
        },
        {
          _id: "notif2",
          message: "Notification 2",
          createdAt: new Date("2023-01-01"), // Older date
        },
      ];

      // Mock Mongoose query chain: find().sort()
      Notification.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockNotifications),
      });

      // Execute the function with mock req/res
      await getNotifications(req, res);

      // Assertions:
      // 1. Correct user filter was applied
      expect(Notification.find).toHaveBeenCalledWith({ user: "userId123" });
      // 2. Results were sorted by createdAt in descending order
      expect(Notification.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
      // 3. Response contains the mock notifications
      expect(res.json).toHaveBeenCalledWith(mockNotifications);
    });

    // Test case: Error handling during notification retrieval
    it("should return 500 if there is a server error", async () => {
      // Mock a failing database query
      Notification.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      // Execute the function
      await getNotifications(req, res);

      // Assertions:
      // 1. Correct status code was set
      expect(res.status).toHaveBeenCalledWith(500);
      // 2. Correct error message was sent
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });
});

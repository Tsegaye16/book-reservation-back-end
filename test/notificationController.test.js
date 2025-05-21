const Notification = require("../models/Notification");
const {
  createNotification,
  getNotifications,
} = require("../controllers/notificationController");

jest.mock("../models/Notification");

describe("Notification Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: {
        id: "userId123",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("createNotification", () => {
    it("should create a new notification", async () => {
      const userId = "userId123";
      const message = "Test notification";
      const type = "test_type";

      const mockNotification = {
        user: userId,
        message,
        type,
        save: jest.fn().mockResolvedValue(true),
      };
      Notification.mockImplementation(() => mockNotification);

      await createNotification(userId, message, type);

      expect(Notification).toHaveBeenCalledWith({
        user: userId,
        message,
        type,
      });
      expect(mockNotification.save).toHaveBeenCalled();
    });

    it("should handle errors when creating notification", async () => {
      const userId = "userId123";
      const message = "Test notification";
      const type = "test_type";

      const mockNotification = {
        save: jest.fn().mockRejectedValue(new Error("Database error")),
      };
      Notification.mockImplementation(() => mockNotification);

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await createNotification(userId, message, type);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating notification:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getNotifications", () => {
    it("should return notifications for the authenticated user sorted by date", async () => {
      const mockNotifications = [
        {
          _id: "notif1",
          message: "Notification 1",
          createdAt: new Date("2023-01-02"),
        },
        {
          _id: "notif2",
          message: "Notification 2",
          createdAt: new Date("2023-01-01"),
        },
      ];

      Notification.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockNotifications),
      });

      await getNotifications(req, res);

      expect(Notification.find).toHaveBeenCalledWith({ user: "userId123" });
      expect(Notification.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.json).toHaveBeenCalledWith(mockNotifications);
    });

    it("should return 500 if there is a server error", async () => {
      Notification.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      await getNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });
});

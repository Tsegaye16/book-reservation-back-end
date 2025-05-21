const User = require("../models/User");
const {
  getUser,
  updateUser,
  approveUser,
  getAllUsers,
} = require("../controllers/userController");

jest.mock("../models/User");

describe("User Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      user: { id: "authenticatedUserId" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("getUser", () => {
    it("should return a user without password field", async () => {
      req.params.id = "userId123";
      const mockUser = {
        _id: "userId123",
        name: "Test User",
        email: "test@example.com",
        toObject: jest.fn().mockReturnValue({
          _id: "userId123",
          name: "Test User",
          email: "test@example.com",
        }),
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await getUser(req, res);

      expect(User.findById).toHaveBeenCalledWith("userId123");
      expect(res.json).toHaveBeenCalledWith({
        _id: "userId123",
        name: "Test User",
        email: "test@example.com",
      });
    });

    it("should return 404 if user not found", async () => {
      req.params.id = "nonexistentId";
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await getUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle server errors", async () => {
      req.params.id = "userId123";
      User.findById.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      await getUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });

  describe("updateUser", () => {
    it("should update user details if authorized", async () => {
      req.params.id = "authenticatedUserId";
      req.body = { name: "Updated Name", phoneNumber: "9876543210" };

      const mockUser = {
        _id: "authenticatedUserId",
        name: "Original Name",
        phoneNumber: "1234567890",
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      await updateUser(req, res);

      expect(User.findById).toHaveBeenCalledWith("authenticatedUserId");
      expect(mockUser.name).toBe("Updated Name");
      expect(mockUser.phoneNumber).toBe("9876543210");
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 404 if user not found", async () => {
      req.params.id = "nonexistentId";
      User.findById.mockResolvedValue(null);

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should return 403 if not authorized to update", async () => {
      req.params.id = "otherUserId";
      const mockUser = {
        _id: "otherUserId",
        toString: () => "otherUserId",
      };
      User.findById.mockResolvedValue(mockUser);

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Not authorized to update this user",
      });
    });

    it("should handle server errors", async () => {
      req.params.id = "authenticatedUserId";
      User.findById.mockRejectedValue(new Error("Database error"));

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });

  describe("approveUser", () => {
    it("should approve a user", async () => {
      req.params.id = "userId123";
      const mockUser = {
        _id: "userId123",
        isApproved: false,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(mockUser);

      await approveUser(req, res);

      expect(User.findById).toHaveBeenCalledWith("userId123");
      expect(mockUser.isApproved).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "User approved successfully",
      });
    });

    it("should return 404 if user not found", async () => {
      req.params.id = "nonexistentId";
      User.findById.mockResolvedValue(null);

      await approveUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle server errors", async () => {
      req.params.id = "userId123";
      User.findById.mockRejectedValue(new Error("Database error"));

      await approveUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });

  describe("getAllUsers", () => {
    it("should return all users without password fields", async () => {
      const mockUsers = [
        { _id: "user1", name: "User One", email: "user1@example.com" },
        { _id: "user2", name: "User Two", email: "user2@example.com" },
      ];
      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUsers),
      });

      await getAllUsers(req, res);

      expect(User.find).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });

    it("should handle server errors", async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });
});

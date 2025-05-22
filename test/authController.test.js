const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { register, login } = require("../controllers/authController");
const { notifyAdmins } = require("../utils/notificationUtils");
const config = require("../config/database");

jest.mock("../models/User");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("../utils/notificationUtils");
jest.mock("../config/database", () => ({
  secret: "test-secret",
}));

describe("Auth Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("register", () => {
    it("should register a new user and return token", async () => {
      req.body = {
        name: "Test User",
        email: "test@example.com",
        phoneNumber: "1234567890",
        password: "password123",
      };

      // Mock User.findOne to return null (user does not exist)
      User.findOne.mockResolvedValue(null);

      // Step 1: Define mockUser with basic properties
      const mockUser = {
        _id: "user123",
        id: "user123", // Simulate Mongoose id getter
        name: "Test User",
        email: "test@example.com",
      };

      // Step 2: Assign the save method after mockUser is defined
      mockUser.save = jest.fn().mockResolvedValue(mockUser);

      // Mock User constructor to return mockUser
      User.mockImplementation(() => mockUser);

      // Mock jwt.sign to return a token
      jwt.sign.mockImplementation((payload, secret, options, callback) => {
        callback(null, "test-token");
      });

      // Execute the register function
      await register(req, res);

      // Assertions
      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(User).toHaveBeenCalledWith({
        name: "Test User",
        email: "test@example.com",
        phoneNumber: "1234567890",
        password: "password123",
        isApproved: false,
      });
      expect(mockUser.save).toHaveBeenCalled();
      expect(notifyAdmins).toHaveBeenCalledWith(
        "New user registered: Test User",
        "new_user"
      );
      expect(jwt.sign).toHaveBeenCalledWith(
        { user: { id: "user123" } },
        "test-secret",
        { expiresIn: "1h" },
        expect.any(Function)
      );
      expect(res.json).toHaveBeenCalledWith({
        token: "test-token",
        userId: "user123",
      });
    });

    // Other register test cases remain unchanged
    it("should return 400 if user already exists", async () => {
      req.body = { email: "existing@example.com" };
      User.findOne.mockResolvedValue({ email: "existing@example.com" });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "User already exists" });
    });

    it("should handle server errors", async () => {
      req.body = { email: "test@example.com" };
      User.findOne.mockRejectedValue(new Error("Database error"));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server error");
    });
  });

  describe("login", () => {
    it("should login an approved user and return token", async () => {
      req.body = {
        email: "test@example.com",
        password: "correctPassword",
      };

      const mockUser = {
        _id: "user123",
        id: "user123", // Simulate Mongoose id getter
        email: "test@example.com",
        password: "hashedPassword",
        isApproved: true,
        isAdmin: false,
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockImplementation((payload, secret, options, callback) => {
        callback(null, "test-token");
      });

      await login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "correctPassword",
        "hashedPassword"
      );
      expect(jwt.sign).toHaveBeenCalledWith(
        { user: { id: "user123", isAdmin: false } },
        "test-secret",
        { expiresIn: "1h" },
        expect.any(Function)
      );
      expect(res.json).toHaveBeenCalledWith({
        token: "test-token",
        isAdmin: false,
      });
    });

    it("should return 400 for invalid credentials (user not found)", async () => {
      req.body = { email: "nonexistent@example.com" };
      User.findOne.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid credentials" });
    });

    it("should return 400 for invalid credentials (wrong password)", async () => {
      req.body = {
        email: "test@example.com",
        password: "wrongPassword",
      };

      const mockUser = {
        email: "test@example.com",
        password: "hashedPassword",
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid credentials" });
    });

    it("should return 403 for unapproved user", async () => {
      req.body = {
        email: "test@example.com",
        password: "correctPassword",
      };

      const mockUser = {
        email: "test@example.com",
        password: "hashedPassword",
        isApproved: false,
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Your account is pending approval",
      });
    });

    it("should include isAdmin in the token payload for admin users", async () => {
      req.body = {
        email: "admin@example.com",
        password: "correctPassword",
      };

      const mockUser = {
        _id: "admin123",
        id: "admin123", // Simulate Mongoose id getter
        email: "admin@example.com",
        password: "hashedPassword",
        isApproved: true,
        isAdmin: true,
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockImplementation((payload, secret, options, callback) => {
        callback(null, "admin-token");
      });

      await login(req, res);

      expect(jwt.sign).toHaveBeenCalledWith(
        { user: { id: "admin123", isAdmin: true } },
        "test-secret",
        { expiresIn: "1h" },
        expect.any(Function)
      );
      expect(res.json).toHaveBeenCalledWith({
        token: "admin-token",
        isAdmin: true,
      });
    });

    it("should handle server errors", async () => {
      req.body = { email: "test@example.com" };
      User.findOne.mockRejectedValue(new Error("Database error"));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server error");
    });
  });
});

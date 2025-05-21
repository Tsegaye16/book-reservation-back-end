const Reservation = require("../models/Reservation");
const Book = require("../models/Book");
const {
  createNotification,
  notifyAdmins,
} = require("../utils/notificationUtils");
const {
  createReservation,
  updateReservationStatus,
  getReservations,
  getReservation,
} = require("../controllers/reservationController");

jest.mock("../models/Reservation");
jest.mock("../models/Book");
jest.mock("../utils/notificationUtils");

describe("Reservation Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      user: {
        id: "userId123",
        name: "Test User",
        isAdmin: false,
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("createReservation", () => {
    it("should create a new reservation and notify admins", async () => {
      req.body = {
        bookId: "bookId123",
        startDate: "2023-01-01",
        endDate: "2023-01-07",
      };

      const mockBook = {
        _id: "bookId123",
        title: "Test Book",
      };
      Book.findById.mockResolvedValue(mockBook);

      const mockReservation = {
        _id: "reservationId123",
        user: "userId123",
        book: "bookId123",
        startDate: "2023-01-01",
        endDate: "2023-01-07",
        status: "pending",
        save: jest.fn().mockResolvedValue(true),
      };
      Reservation.mockImplementation(() => mockReservation);

      await createReservation(req, res);

      expect(Book.findById).toHaveBeenCalledWith("bookId123");
      expect(Reservation).toHaveBeenCalledWith({
        user: "userId123",
        book: "bookId123",
        startDate: "2023-01-01",
        endDate: "2023-01-07",
        status: "pending",
      });
      expect(mockReservation.save).toHaveBeenCalled();
      expect(notifyAdmins).toHaveBeenCalledWith(
        'New reservation request from Test User for "Test Book"',
        "new_reservation"
      );
      expect(res.json).toHaveBeenCalledWith(mockReservation);
    });

    it("should return 404 if book not found", async () => {
      req.body = { bookId: "nonexistentBook" };
      Book.findById.mockResolvedValue(null);

      await createReservation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Book not found" });
    });

    it("should handle server errors", async () => {
      req.body = { bookId: "bookId123" };
      Book.findById.mockRejectedValue(new Error("Database error"));

      await createReservation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });

  describe("updateReservationStatus", () => {
    it("should update reservation status and notify user", async () => {
      req.params.id = "reservationId123";
      req.body = { status: "approved" };

      const mockBook = {
        _id: "bookId123",
        title: "Test Book",
      };

      const mockReservation = {
        _id: "reservationId123",
        user: "userId456",
        book: mockBook,
        status: "pending",
        save: jest.fn().mockResolvedValue(true),
      };
      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockReservation),
      });

      await updateReservationStatus(req, res);

      expect(Reservation.findById).toHaveBeenCalledWith("reservationId123");
      expect(mockReservation.status).toBe("approved");
      expect(mockReservation.save).toHaveBeenCalled();
      expect(createNotification).toHaveBeenCalledWith(
        "userId456",
        'Your reservation for "Test Book" has been approved',
        "reservation_status"
      );
      expect(res.json).toHaveBeenCalledWith(mockReservation);
    });

    it("should return 404 if reservation not found", async () => {
      req.params.id = "nonexistentReservation";
      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await updateReservationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Reservation not found",
      });
    });

    it("should handle server errors", async () => {
      req.params.id = "reservationId123";
      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      await updateReservationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });

  describe("getReservations", () => {
    it("should return all reservations with populated data", async () => {
      const mockReservations = [
        {
          _id: "res1",
          user: { _id: "user1", name: "User One" },
          book: { _id: "book1", title: "Book One" },
        },
        {
          _id: "res2",
          user: { _id: "user2", name: "User Two" },
          book: { _id: "book2", title: "Book Two" },
        },
      ];

      Reservation.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockReservations),
        }),
      });

      await getReservations(req, res);

      expect(Reservation.find).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockReservations);
    });

    it("should handle server errors", async () => {
      Reservation.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      await getReservations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });

  describe("getReservation", () => {
    it("should return reservation if user is owner", async () => {
      req.params.id = "reservationId123";
      req.user.id = "userId123";

      const mockReservation = {
        _id: "reservationId123",
        user: { _id: "userId123", name: "Test User" },
        book: { _id: "bookId123", title: "Test Book" },
        toString: () => "userId123",
      };

      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockReservation),
        }),
      });

      await getReservation(req, res);

      expect(Reservation.findById).toHaveBeenCalledWith("reservationId123");
      expect(res.json).toHaveBeenCalledWith(mockReservation);
    });

    it("should return reservation if user is admin", async () => {
      req.params.id = "reservationId123";
      req.user.isAdmin = true;

      const mockReservation = {
        _id: "reservationId123",
        user: { _id: "userId456", name: "Other User" },
        book: { _id: "bookId123", title: "Test Book" },
      };

      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockReservation),
        }),
      });

      await getReservation(req, res);

      expect(res.json).toHaveBeenCalledWith(mockReservation);
    });

    it("should return 404 if reservation not found", async () => {
      req.params.id = "nonexistentReservation";
      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await getReservation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Reservation not found",
      });
    });

    it("should return 403 if not authorized", async () => {
      req.params.id = "reservationId123";
      req.user.id = "userId123";
      req.user.isAdmin = false;

      const mockReservation = {
        _id: "reservationId123",
        user: { _id: "userId456", name: "Other User" },
        book: { _id: "bookId123", title: "Test Book" },
        toString: () => "userId456",
      };

      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockReservation),
        }),
      });

      await getReservation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Not authorized to view this reservation",
      });
    });

    it("should handle server errors", async () => {
      req.params.id = "reservationId123";
      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      await getReservation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Server Error");
    });
  });
});

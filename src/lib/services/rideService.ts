import mongoose, { Types } from "mongoose";
import { Ride, type RideDoc } from "../../models/Ride";
import { Trip, type TripDoc } from "../../models/Trip";
import { Availability, type AvailabilityDoc } from "../../models/Availability";

type MatchResult = {
  availabilityId: Types.ObjectId | string;
  driverId: Types.ObjectId | string;
  date: string;
  vehicleType: string;
  rideType: string;
  startTime: string;
  endTime: string;
  passengers: Array<{
    tripId: Types.ObjectId | string;
    userId?: Types.ObjectId | string;
    pickup: any;
    dropoff: any;
    pickupOrder: number;
    dropoffOrder: number;
    numberOfPassengers: number;
    tripCost: number;
    priceEgp?: number;
  }>;
  totalCost?: number;
  status?: string;
  seatsRemaining?: number;
  route?: any[]; // StopSchema-compatible array optional; if absent will be calculated
};

async function createRide(matchResult: MatchResult) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const availability = await Availability.findById(
      matchResult.availabilityId,
    ).session(session);
    if (!availability) throw new Error("Availability not found");

    const passengersForRide = matchResult.passengers.map((p) => ({
      tripId: p.tripId,
      userId: p.userId || null,
      pickup: p.pickup,
      dropoff: p.dropoff,
      pickupOrder: p.pickupOrder,
      dropoffOrder: p.dropoffOrder,
      tripCost: p.priceEgp || 0,
      numberOfPassengers: p.numberOfPassengers || 1,
      status: "waiting",
    }));

    const rideNumber = await getNextSequence("rideNumber", session);
    const rideDoc = new Ride({
      rideNumber,
      availabilityId: matchResult.availabilityId,
      driverId: matchResult.driverId,
      date: matchResult.date,
      vehicleType: matchResult.vehicleType,
      rideType: matchResult.rideType,
      startTime: matchResult.startTime,
      endTime: matchResult.endTime,
      passengers: passengersForRide,
      totalCost: passengersForRide.reduce(
        (sum, p) => sum + (p.tripCost || 0),
        0,
      ),
      route: matchResult.route || [],
    });

    // if route absent, compute basic route from passengers
    if (!matchResult.route) {
      rideDoc.route = recalculateRouteFromPassengers(passengersForRide);
    }

    await rideDoc.save({ session });

    // update availability (no seatsRemaining tracking for now)
    availability.rideId = rideDoc._id;
    availability.status = "matched";
    await availability.save({ session });

    // update trips
    for (const p of matchResult.passengers) {
      await Trip.findByIdAndUpdate(
        p.tripId,
        {
          $set: {
            rideId: rideDoc._id,
            status: "matched",
            driverId: matchResult.driverId,
          },
        },
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();
    return rideDoc;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function getNextSequence(name: string, session: mongoose.ClientSession) {
  const coll: any = mongoose.connection.collection("counters");
  const res: any = await coll.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, session },
  );
  return (res.value && (res.value.seq as number)) || 1;
}

function recalculateRouteFromPassengers(passengers: any[]) {
  // Build stops array by order indices. Aggregate boarding/alighting counts per order.
  const indexMap: Record<number, any> = {};
  let maxIndex = 0;
  for (const p of passengers) {
    const b = p.pickupOrder;
    const a = p.dropoffOrder;
    maxIndex = Math.max(maxIndex, b, a);
    if (!indexMap[b])
      indexMap[b] = {
        point: p.pickup,
        boarding: 0,
        alighting: 0,
        waitingMinutes: 0,
      };
    if (!indexMap[a])
      indexMap[a] = {
        point: p.dropoff,
        boarding: 0,
        alighting: 0,
        waitingMinutes: 0,
      };
    indexMap[b].boarding += p.numberOfPassengers || 1;
    indexMap[a].alighting += p.numberOfPassengers || 1;
  }
  const stops = [];
  for (let i = 0; i <= maxIndex; i++) {
    if (indexMap[i]) {
      stops.push({
        point: indexMap[i].point,
        boarding: indexMap[i].boarding || 0,
        alighting: indexMap[i].alighting || 0,
        waitingMinutes: indexMap[i].waitingMinutes || 0,
      });
    }
  }
  return stops;
}

async function getRideById(id: string | Types.ObjectId) {
  return Ride.findById(id).lean();
}

async function getRideByNumber(rideNumber: number) {
  return Ride.findOne({ rideNumber }).lean();
}

async function getRidesByDriver(
  driverId: string | Types.ObjectId,
  date?: string,
) {
  const q: any = { driverId };
  if (date) q.date = date;
  return Ride.find(q).sort({ date: -1, startTime: 1 }).lean();
}

async function getActiveRideForDriver(driverId: string | Types.ObjectId) {
  return Ride.findOne({
    driverId,
    status: { $in: ["matched", "confirmed", "active"] },
  }).lean();
}

async function getRideByAvailability(availabilityId: string | Types.ObjectId) {
  return Ride.findOne({ availabilityId }).lean();
}

async function updateRideStatus(
  rideId: string | Types.ObjectId,
  status: string,
) {
  return Ride.findByIdAndUpdate(rideId, { $set: { status } }, { new: true });
}

async function updatePassengerStatusInRide(
  rideId: string | Types.ObjectId,
  tripId: string | Types.ObjectId,
  status: string,
) {
  const res = await Ride.findOneAndUpdate(
    { _id: rideId, "passengers.tripId": tripId },
    { $set: { "passengers.$.status": status } },
    { new: true },
  );
  return res;
}

async function addPassengerToRide(
  rideId: string | Types.ObjectId,
  passenger: any,
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new Error("Ride not found");
    const availability = await Availability.findById(
      ride.availabilityId,
    ).session(session);
    if (!availability) throw new Error("Availability not found");
    // no seatsRemaining checks for now

    ride.passengers.push({
      tripId: passenger.tripId,
      userId: passenger.userId || null,
      pickup: passenger.pickup,
      dropoff: passenger.dropoff,
      pickupOrder: passenger.pickupOrder,
      dropoffOrder: passenger.dropoffOrder,
      numberOfPassengers: passenger.numberOfPassengers || 1,
      status: "waiting",
    });

    // recompute route
    ride.route = recalculateRouteFromPassengers(ride.passengers as any[]);

    // do not modify seatsRemaining; keep availability marked matched
    availability.status = "matched";

    await Trip.findByIdAndUpdate(
      passenger.tripId,
      { $set: { rideId: ride._id, status: "matched" } },
      { session },
    );
    await ride.save({ session });
    await availability.save({ session });

    await session.commitTransaction();
    session.endSession();
    return ride;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function removePassengerFromRide(
  rideId: string | Types.ObjectId,
  tripId: string | Types.ObjectId,
  reason?: string,
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new Error("Ride not found");
    const availability = await Availability.findById(
      ride.availabilityId,
    ).session(session);
    if (!availability) throw new Error("Availability not found");

    const passenger = ride.passengers.find(
      (p: any) => p.tripId?.toString() === tripId.toString(),
    );
    if (!passenger) throw new Error("Passenger not in ride");

    ride.passengers = ride.passengers.filter(
      (p: any) => p.tripId?.toString() !== tripId.toString(),
    );
    ride.route = recalculateRouteFromPassengers(ride.passengers as any[]);

    await Trip.findByIdAndUpdate(
      tripId,
      { $set: { rideId: null, status: "submitted" } },
      { session },
    );
    await ride.save({ session });
    await availability.save({ session });

    await session.commitTransaction();
    session.endSession();
    return ride;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function recalculateRoute(rideId: string | Types.ObjectId) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new Error("Ride not found");
  ride.route = recalculateRouteFromPassengers(ride.passengers as any[]);
  await ride.save();
  return ride;
}

async function getRideByPassengerIncluded(
  passengerId: string | Types.ObjectId,
) {
  // Match either a passenger's tripId or userId to be flexible about passed id
  const q: any = {
    $or: [
      { "passengers.tripId": passengerId },
      { "passengers.userId": passengerId },
    ],
  };
  return Ride.find(q).sort({ date: -1, startTime: 1 }).lean();
}

async function cancelRide(rideId: string | Types.ObjectId, reason?: string) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new Error("Ride not found");

    // set status
    ride.status = "cancelled" as any;
    await ride.save({ session });

    // unlink trips
    const tripIds = ride.passengers.map((p: any) => p.tripId);
    const seats = ride.passengers.reduce(
      (s: number, p: any) => s + (p.numberOfPassengers || 1),
      0,
    );

    await Trip.updateMany(
      { _id: { $in: tripIds } },
      { $set: { rideId: null, status: "submitted" } },
      { session },
    );

    // release availability
    if (ride.availabilityId) {
      const availability = await Availability.findById(
        ride.availabilityId,
      ).session(session);
      if (availability) {
        availability.rideId = null;
        availability.status = "open";
        await availability.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();
    return ride;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

export {
  createRide,
  getRideById,
  getRideByNumber,
  getRidesByDriver,
  getRideByPassengerIncluded,
  getActiveRideForDriver,
  getRideByAvailability,
  updateRideStatus,
  updatePassengerStatusInRide,
  addPassengerToRide,
  removePassengerFromRide,
  recalculateRoute,
  cancelRide,
};

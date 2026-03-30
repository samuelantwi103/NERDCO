import { z } from 'zod';

export const vehicleSchema = z.object({
  license_plate: z.string().min(2, 'License plate is required').max(20),
  vehicle_type: z.string().nonempty('Vehicle type is required'),
  driver_user_id: z.string().optional().or(z.literal('')),
});

export const staffSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  role: z.string().nonempty('Role is required'),
});

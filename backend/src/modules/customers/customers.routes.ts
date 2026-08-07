import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import type { Request } from "express";
import { authenticate, requirePermission } from "../auth/auth.middleware.js";
import {
  createAddressSchema,
  createCustomerSchema,
  customerAddressIdSchema,
  customerIdSchema,
  listCustomersSchema,
  updateAddressSchema,
  updateCustomerSchema,
} from "./customers.schemas.js";
import * as service from "./customers.service.js";
import { requireModule } from "../platform/module-gate.js";
import { communicationPreferenceSchema, consentSchema, contactIdSchema, contactSchema, customerProfileIdempotencyKeySchema, duplicateQuerySchema, fiscalProfileSchema, identityProfileSchema, relationshipSchema } from "./customer-profile.schemas.js";
import * as profileService from "./customer-profile.service.js";

export const customersRouter = Router();
customersRouter.use(authenticate);
customersRouter.use(requireModule("customers"));
const actor = (req: Request): service.Actor => ({
  companyId: req.auth!.companyId,
  branchId: req.auth!.branchId,
  userId: req.auth!.userId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

customersRouter.get(
  "/",
  requirePermission("customers.view"),
  asyncHandler(async (req, res) =>
    res.json(
      await service.listCustomers(
        req.auth!.companyId,
        listCustomersSchema.parse(req.query),
      ),
    ),
  ),
);
customersRouter.get(
  "/possible-duplicates",
  requirePermission("customers.view"),
  asyncHandler(async (req, res) => res.json({ data: await profileService.possibleDuplicates(req.auth!.companyId, duplicateQuerySchema.parse(req.query)) })),
);
customersRouter.get(
  "/:id",
  requirePermission("customers.view"),
  asyncHandler(async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    res.json({ customer: await service.getCustomer(req.auth!.companyId, id) });
  }),
);
customersRouter.post(
  "/",
  requirePermission("customers.create"),
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json({
        customer: await service.createCustomer(
          actor(req),
          createCustomerSchema.parse(req.body),
        ),
      }),
  ),
);
customersRouter.patch(
  "/:id",
  requirePermission("customers.update"),
  asyncHandler(async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    res.json({
      customer: await service.updateCustomer(
        actor(req),
        id,
        updateCustomerSchema.parse(req.body),
      ),
    });
  }),
);
customersRouter.delete(
  "/:id",
  requirePermission("customers.delete"),
  asyncHandler(async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    await service.deleteCustomer(actor(req), id);
    res.status(204).send();
  }),
);
customersRouter.get("/:id/profile", requirePermission("customers.view"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.json({ profile: await profileService.getCustomerProfile(req.auth!.companyId, id) });
}));
customersRouter.put("/:id/identity", requirePermission("customers.update"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.json({ identity: await profileService.upsertIdentity(actor(req), id, identityProfileSchema.parse(req.body)) });
}));
customersRouter.get("/:id/contacts", requirePermission("customers.view"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.json({ data: await profileService.listContacts(req.auth!.companyId, id) });
}));
customersRouter.post("/:id/contacts", requirePermission("customers.create"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.status(201).json({ contact: await profileService.createContact(actor(req), id, contactSchema.parse(req.body)) });
}));
customersRouter.delete("/:id/contacts/:contactId", requirePermission("customers.update"), asyncHandler(async (req, res) => {
  const { id, contactId } = contactIdSchema.parse(req.params);
  await profileService.deactivateContact(actor(req), id, contactId); res.status(204).send();
}));
customersRouter.put("/:id/fiscal-profile", requirePermission("customers.update"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.json({ fiscalProfile: await profileService.upsertFiscal(actor(req), id, fiscalProfileSchema.parse(req.body)) });
}));
customersRouter.post("/:id/relationships", requirePermission("customers.create"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.status(201).json({ relationship: await profileService.createRelationship(actor(req), id, relationshipSchema.parse(req.body)) });
}));
customersRouter.put("/:id/communication-preference", requirePermission("customers.update"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.json({ preference: await profileService.upsertCommunicationPreference(actor(req), id, communicationPreferenceSchema.parse(req.body)) });
}));
customersRouter.post("/:id/consents", requirePermission("customers.update"), asyncHandler(async (req, res) => {
  const { id } = customerIdSchema.parse(req.params);
  res.status(201).json({ consent: await profileService.recordConsent(actor(req), id, consentSchema.parse(req.body), customerProfileIdempotencyKeySchema.parse(req.get("idempotency-key"))) });
}));
customersRouter.get(
  "/:id/addresses",
  requirePermission("customers.view"),
  asyncHandler(async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    res.json({ data: await service.listAddresses(req.auth!.companyId, id) });
  }),
);
customersRouter.post(
  "/:id/addresses",
  requirePermission("customers.create"),
  asyncHandler(async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    res
      .status(201)
      .json({
        address: await service.createAddress(
          actor(req),
          id,
          createAddressSchema.parse(req.body),
        ),
      });
  }),
);
customersRouter.patch(
  "/:id/addresses/:addressId",
  requirePermission("customers.update"),
  asyncHandler(async (req, res) => {
    const { id, addressId } = customerAddressIdSchema.parse(req.params);
    res.json({
      address: await service.updateAddress(
        actor(req),
        id,
        addressId,
        updateAddressSchema.parse(req.body),
      ),
    });
  }),
);
customersRouter.delete(
  "/:id/addresses/:addressId",
  requirePermission("customers.delete"),
  asyncHandler(async (req, res) => {
    const { id, addressId } = customerAddressIdSchema.parse(req.params);
    await service.deleteAddress(actor(req), id, addressId);
    res.status(204).send();
  }),
);

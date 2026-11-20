import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { Service } from "./models/Service";

const SAMPLE_SERVICES = [
  {
    serviceName: "Signature Precision Haircut & Blowout",
    category: "Haircut & Styling",
    description:
      "A tailored consultation, relaxing scalp wash, precision cut crafted for your face shape, and a voluminous salon blowout finish.",
    price: 65,
    duration: 60,
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
  {
    serviceName: "Dimensional Balayage & Gloss",
    category: "Hair Coloring",
    description:
      "Hand-painted sun-kissed highlights customized to your natural tone, finished with a bond-building gloss and signature styling.",
    price: 185,
    duration: 150,
    image:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
  {
    serviceName: "Keratin Silk Smoothing Treatment",
    category: "Hair Treatment",
    description:
      "Deep nourishing keratin infusion that eliminates frizz, restores mirror-like shine, and keeps hair effortlessly smooth for weeks.",
    price: 150,
    duration: 120,
    image:
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
  {
    serviceName: "HydraGlow Botanical Facial",
    category: "Facial & Skincare",
    description:
      "Revitalizing multi-step facial combining gentle enzymatic exfoliation, hyaluronic hydration, and LED therapy for luminous skin.",
    price: 110,
    duration: 75,
    image:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
  {
    serviceName: "Bridal & Editorial Glam Makeup",
    category: "Makeup",
    description:
      "Long-wear luxury makeup artistry using skin-first prep and high-definition finishes tailored for weddings, galas, and shoots.",
    price: 130,
    duration: 90,
    image:
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
  {
    serviceName: "Luxury Gel Manicure & Spa Pedicure",
    category: "Manicure & Pedicure",
    description:
      "Complete cuticle care, aromatic sugar scrub, hydrating massage, and chip-resistant gel polish in our serene nail lounge.",
    price: 85,
    duration: 75,
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
  {
    serviceName: "Aromatherapy Deep Tissue Spa Massage",
    category: "Spa & Massage",
    description:
      "Full-body therapeutic massage using warm organic botanical oils to melt tension, boost circulation, and restore calm.",
    price: 120,
    duration: 60,
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
  {
    serviceName: "Silk Press & Scalp Detox Ritual",
    category: "Haircut & Styling",
    description:
      "Detoxifying botanical scalp massage, deep steam hydration mask, and sleek heat-protected silk press with effortless movement.",
    price: 95,
    duration: 90,
    image:
      "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80",
    status: "active",
  },
];

async function seed() {
  try {
    await connectDB();
    const existingCount = await Service.countDocuments();

    if (existingCount > 0) {
      console.log(
        `Services collection already has ${existingCount} records. Skipping seed.`
      );
    } else {
      await Service.insertMany(SAMPLE_SERVICES);
      console.log(`Seeded ${SAMPLE_SERVICES.length} salon services successfully.`);
    }
  } catch (error) {
    console.error("Seed error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();

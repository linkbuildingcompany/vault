// src/app/api/vault/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = req.nextUrl;

  const search = searchParams.get("search") || "";
  const reviewStatus = searchParams.get("reviewStatus") || "";
  const systemStatus = searchParams.get("systemStatus") || "";
  const siteType = searchParams.get("siteType") || "";
  const month = searchParams.get("month") || ""; // "YYYY-MM"
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || String(PAGE_SIZE)));
  const offset = (page - 1) * limit;

  // Main query (filtered + paginated)
  let query = supabase
    .from("website_reviews")
    .select("*", { count: "exact" });

  if (search) query = query.ilike("domain", `%${search}%`);
  if (reviewStatus) query = query.eq("review_status", reviewStatus);
  if (systemStatus) query = query.eq("system_status", systemStatus);
  if (siteType) query = query.eq("site_type", siteType);
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const nextMonth = new Date(y, m, 1);
    const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
    query = query.gte("date_added", start).lt("date_added", end);
  }

  query = query
    .order("date_added", { ascending: sort === "oldest" })
    .order("created_at", { ascending: sort === "oldest" })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Summary counts (always across full table, no filters)
  const { data: allItems } = await supabase
    .from("website_reviews")
    .select("review_status, system_status, site_type");

  const summary = {
    total: allItems?.length ?? 0,
    pendingReview: allItems?.filter(i => i.review_status === "Pending Review").length ?? 0,
    approved: allItems?.filter(i => i.review_status === "Approved").length ?? 0,
    rejected: allItems?.filter(i => i.review_status === "Rejected").length ?? 0,
    needsChanges: allItems?.filter(i => i.review_status === "Needs Changes").length ?? 0,
    addedToSystem: allItems?.filter(i => i.system_status === "Added to System").length ?? 0,
    notAddedToSystem: allItems?.filter(i => i.system_status === "Not Added to System").length ?? 0,
  };

  // Payment calculation — for selected month OR current month
  const paymentMonth = month || new Date().toISOString().substring(0, 7);
  const [py, pm] = paymentMonth.split("-").map(Number);
  const payStart = `${paymentMonth}-01`;
  const payNextMonth = new Date(py, pm, 1);
  const payEnd = `${payNextMonth.getFullYear()}-${String(payNextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: paymentItems } = await supabase
    .from("website_reviews")
    .select("site_type")
    .gte("date_added", payStart)
    .lt("date_added", payEnd)
    .eq("system_status", "Added to System");

  const internalCount = paymentItems?.filter(i => i.site_type === "Internal").length ?? 0;
  const externalCount = paymentItems?.filter(i => i.site_type === "External").length ?? 0;
  const monthlyPayment = internalCount * 1500 + externalCount * 500;

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
    summary,
    payment: {
      month: paymentMonth,
      internalCount,
      externalCount,
      total: monthlyPayment,
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();

  let domain = (body.domain || "").trim().toLowerCase();
  domain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  if (!domain) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 });
  }

  const siteType = body.site_type === "Internal" ? "Internal" : "External";
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("website_reviews")
    .insert({
      domain,
      review_status: "Pending Review",
      system_status: "Not Added to System",
      site_type: siteType,
      date_added: today,
      review_comments: "",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This domain already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.userEmail) {
    await supabase.from("review_audit_log").insert({
      website_id: data.id,
      domain,
      user_email: body.userEmail,
      field_changed: "domain",
      previous_value: null,
      new_value: domain,
    });
  }

  return NextResponse.json(data, { status: 201 });
}

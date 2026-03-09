import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_API_KEY = Deno.env.get("AI_API_KEY");
const BACKEND_URL = Deno.env.get("BACKEND_URL")!;
const BACKEND_SERVICE_KEY = Deno.env.get("BACKEND_SERVICE_KEY")!;

const backendClient = createClient(BACKEND_URL, BACKEND_SERVICE_KEY);

const SYSTEM_PROMPT = `You are a multilingual healthcare appointment assistant for 2Care.ai. You help patients book, reschedule, and cancel clinical appointments.

You support English, Hindi (हिंदी), Tamil (தமிழ்), and Telugu (తెలుగు). Always respond in the same language the patient uses.

You have access to the following tools to manage appointments. Always use them when needed.

When booking:
1. Ask which doctor/specialty they need
2. Ask preferred date
3. Check availability using check_availability
4. Confirm and book using book_appointment

When rescheduling:
1. Find existing appointment
2. Ask for new preferred date/time
3. Check availability
4. Reschedule using reschedule_appointment

When cancelling:
1. Confirm which appointment to cancel
2. Cancel using cancel_appointment

Be conversational, empathetic, and professional. Keep responses concise for voice interaction.
If the user is speaking Hindi, Tamil, or Telugu, respond entirely in that language.`;

const tools = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check doctor availability for a given specialty and date. Returns available time slots.",
      parameters: {
        type: "object",
        properties: {
          specialty: {
            type: "string",
            description: "Medical specialty (e.g. Cardiologist, Dermatologist)",
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format",
          },
          doctor_name: {
            type: "string",
            description: "Optional specific doctor name",
          },
        },
        required: ["specialty"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book an appointment for a patient with a doctor at a specific time.",
      parameters: {
        type: "object",
        properties: {
          patient_name: { type: "string", description: "Patient name" },
          doctor_name: { type: "string", description: "Doctor name" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM format" },
        },
        required: ["patient_name", "doctor_name", "date", "time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancel an existing appointment by appointment ID or patient details.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string", description: "Appointment ID" },
          patient_name: { type: "string", description: "Patient name to find appointment" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Reschedule an existing appointment to a new date and time.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string", description: "Appointment ID" },
          patient_name: { type: "string", description: "Patient name" },
          new_date: { type: "string", description: "New date in YYYY-MM-DD format" },
          new_time: { type: "string", description: "New time in HH:MM format" },
        },
        required: ["new_date", "new_time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_appointments",
      description: "List all appointments for a patient.",
      parameters: {
        type: "object",
        properties: {
          patient_name: { type: "string", description: "Patient name" },
        },
        required: ["patient_name"],
        additionalProperties: false,
      },
    },
  },
];

async function executeToolCall(name: string, args: Record<string, string>) {
  console.log(`Executing tool: ${name}`, args);

  switch (name) {
    case "check_availability": {
      let query = backendClient
        .from("doctor_slots")
        .select("*, doctors!inner(name, specialty, hospital)")
        .eq("is_available", true);

      if (args.specialty) {
        query = query.ilike("doctors.specialty", `%${args.specialty}%`);
      }
      if (args.doctor_name) {
        query = query.ilike("doctors.name", `%${args.doctor_name}%`);
      }
      if (args.date) {
        query = query.eq("slot_date", args.date);
      } else {
        // Default to next 3 days
        const today = new Date().toISOString().split("T")[0];
        const future = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
        query = query.gte("slot_date", today).lte("slot_date", future);
      }

      const { data, error } = await query.limit(10);
      if (error) return JSON.stringify({ error: error.message });
      if (!data?.length) return JSON.stringify({ message: "No available slots found for the given criteria." });

      return JSON.stringify(
        data.map((s: any) => ({
          date: s.slot_date,
          time: s.slot_time,
          doctor: s.doctors.name,
          specialty: s.doctors.specialty,
          hospital: s.doctors.hospital,
          slot_id: s.id,
        }))
      );
    }

    case "book_appointment": {
      // Find or create patient
      let { data: patient } = await backendClient
        .from("patients")
        .select("id")
        .ilike("name", `%${args.patient_name}%`)
        .single();

      if (!patient) {
        const { data: newPatient } = await backendClient
          .from("patients")
          .insert({ name: args.patient_name })
          .select("id")
          .single();
        patient = newPatient;
      }

      // Find doctor
      const { data: doctor } = await backendClient
        .from("doctors")
        .select("id")
        .ilike("name", `%${args.doctor_name}%`)
        .single();

      if (!doctor) return JSON.stringify({ error: `Doctor ${args.doctor_name} not found` });

      // Find and claim slot
      const { data: slot } = await backendClient
        .from("doctor_slots")
        .select("id")
        .eq("doctor_id", doctor.id)
        .eq("slot_date", args.date)
        .eq("slot_time", args.time + ":00")
        .eq("is_available", true)
        .single();

      if (!slot) return JSON.stringify({ error: "The requested slot is not available. Please check availability first." });

      // Mark slot as unavailable
      await backendClient.from("doctor_slots").update({ is_available: false }).eq("id", slot.id);

      // Create appointment
      const { data: appt, error } = await backendClient
        .from("appointments")
        .insert({
          patient_id: patient!.id,
          doctor_id: doctor.id,
          slot_id: slot.id,
          appointment_date: args.date,
          appointment_time: args.time + ":00",
        })
        .select("id")
        .single();

      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, appointment_id: appt!.id, message: `Appointment booked successfully with ${args.doctor_name} on ${args.date} at ${args.time}` });
    }

    case "cancel_appointment": {
      let query = backendClient.from("appointments").select("id, slot_id").eq("status", "confirmed");

      if (args.appointment_id) {
        query = query.eq("id", args.appointment_id);
      } else if (args.patient_name) {
        const { data: patient } = await backendClient.from("patients").select("id").ilike("name", `%${args.patient_name}%`).single();
        if (!patient) return JSON.stringify({ error: "Patient not found" });
        query = query.eq("patient_id", patient.id);
      }

      const { data: appts } = await query.limit(1).single();
      if (!appts) return JSON.stringify({ error: "No active appointment found" });

      await backendClient.from("appointments").update({ status: "cancelled" }).eq("id", appts.id);
      if (appts.slot_id) {
        await backendClient.from("doctor_slots").update({ is_available: true }).eq("id", appts.slot_id);
      }

      return JSON.stringify({ success: true, message: "Appointment cancelled successfully" });
    }

    case "reschedule_appointment": {
      let apptQuery = backendClient.from("appointments").select("id, slot_id, doctor_id").eq("status", "confirmed");

      if (args.appointment_id) {
        apptQuery = apptQuery.eq("id", args.appointment_id);
      } else if (args.patient_name) {
        const { data: patient } = await backendClient.from("patients").select("id").ilike("name", `%${args.patient_name}%`).single();
        if (!patient) return JSON.stringify({ error: "Patient not found" });
        apptQuery = apptQuery.eq("patient_id", patient.id);
      }

      const { data: appt } = await apptQuery.limit(1).single();
      if (!appt) return JSON.stringify({ error: "No active appointment found to reschedule" });

      // Free old slot
      if (appt.slot_id) {
        await backendClient.from("doctor_slots").update({ is_available: true }).eq("id", appt.slot_id);
      }

      // Find new slot
      const { data: newSlot } = await backendClient
        .from("doctor_slots")
        .select("id")
        .eq("doctor_id", appt.doctor_id)
        .eq("slot_date", args.new_date)
        .eq("slot_time", args.new_time + ":00")
        .eq("is_available", true)
        .single();

      if (!newSlot) return JSON.stringify({ error: "New time slot not available" });

      await backendClient.from("doctor_slots").update({ is_available: false }).eq("id", newSlot.id);
      await backendClient
        .from("appointments")
        .update({
          appointment_date: args.new_date,
          appointment_time: args.new_time + ":00",
          slot_id: newSlot.id,
          status: "confirmed",
        })
        .eq("id", appt.id);

      return JSON.stringify({ success: true, message: `Appointment rescheduled to ${args.new_date} at ${args.new_time}` });
    }

    case "list_appointments": {
      const { data: patient } = await backendClient.from("patients").select("id").ilike("name", `%${args.patient_name}%`).single();
      if (!patient) return JSON.stringify({ error: "Patient not found" });

      const { data: appts } = await backendClient
        .from("appointments")
        .select("*, doctors(name, specialty, hospital)")
        .eq("patient_id", patient.id)
        .eq("status", "confirmed")
        .order("appointment_date", { ascending: true });

      if (!appts?.length) return JSON.stringify({ message: "No upcoming appointments found" });

      return JSON.stringify(
        appts.map((a: any) => ({
          id: a.id,
          date: a.appointment_date,
          time: a.appointment_time,
          doctor: a.doctors.name,
          specialty: a.doctors.specialty,
          hospital: a.doctors.hospital,
          status: a.status,
        }))
      );
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, session_id } = await req.json();

    if (!AI_API_KEY) throw new Error("AI_API_KEY is not configured");

    const startTime = performance.now();

    // Get conversation history from memory if session exists
    let conversationMessages = [...messages];
    if (session_id) {
      const { data: history } = await backendClient
        .from("conversation_memory")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true })
        .limit(20);

      if (history?.length) {
        conversationMessages = [...history, ...messages.filter((m: any) => m.role === "user").slice(-1)];
      }
    }

    // Initial LLM call
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...conversationMessages],
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    let result = await response.json();
    let assistantMessage = result.choices[0].message;

    // Handle tool calls in a loop
    const toolMessages: any[] = [];
    let iterations = 0;
    while (assistantMessage.tool_calls && iterations < 5) {
      iterations++;
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const toolResult = await executeToolCall(toolCall.function.name, args);
        toolMessages.push(assistantMessage);
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Follow-up call with tool results
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationMessages,
            ...toolMessages,
          ],
          tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) throw new Error(`AI gateway error on tool follow-up: ${response.status}`);
      result = await response.json();
      assistantMessage = result.choices[0].message;
    }

    const agentDuration = Math.round(performance.now() - startTime);
    const finalContent = assistantMessage.content || "I apologize, I couldn't process that request.";

    // Store in memory
    if (session_id) {
      const lastUserMsg = messages[messages.length - 1];
      await backendClient.from("conversation_memory").insert([
        { session_id, role: "user", content: lastUserMsg.content },
        { session_id, role: "assistant", content: finalContent },
      ]);

      // Log latency
      await backendClient.from("latency_logs").insert({
        session_id,
        stage: "agent_reasoning",
        duration_ms: agentDuration,
      });
    }

    return new Response(
      JSON.stringify({
        content: finalContent,
        latency_ms: agentDuration,
        tools_used: toolMessages.length > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

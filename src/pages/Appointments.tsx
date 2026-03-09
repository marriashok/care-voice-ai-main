import { useEffect, useState } from "react";
import { myBackend } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, User, Stethoscope, Building } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string | null;
  doctors: { name: string; specialty: string; hospital: string | null };
  patients: { name: string };
}

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const [apptList, setApptList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // function to fetch data from backend
  useEffect(() => {
    async function load() {
      var dbRes = await myBackend
        .from("appointments")
        .select("*, doctors(name, specialty, hospital), patients(name)")
        .order("appointment_date", { ascending: true });

      let dataTemp = dbRes.data;
      console.log('appointment data ->', dataTemp); // check if this works

      setApptList((dataTemp as any) || []);
      setLoading(false);
    }
    load();
  }, []);

  const statusColors: Record<string, string> = {
    confirmed: "bg-success/20 text-success",
    cancelled: "bg-destructive/20 text-destructive",
    rescheduled: "bg-warning/20 text-warning",
    completed: "bg-primary/20 text-primary",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Appointments</h1>
          <p className="text-xs text-muted-foreground">Manage clinical appointments</p>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto">
        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : apptList.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No appointments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Use the voice agent to book one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Loop through all appointments and render them */}
            {apptList.map((appt, i) => (
              <motion.div
                key={appt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary" />
                      <span className="font-heading font-semibold text-foreground">
                        {appt.doctors?.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {appt.doctors?.specialty}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {appt.patients?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {appt.appointment_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {appt.appointment_time}
                      </span>
                      {appt.doctors?.hospital && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {appt.doctors.hospital}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[appt.status] || "bg-muted text-muted-foreground"}`}>
                    {appt.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

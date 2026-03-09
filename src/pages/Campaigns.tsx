import { useEffect, useState } from "react";
import { myBackend } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Clock, Bell, Syringe, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface Campaign {
  id: string;
  campaign_type: string;
  message: string;
  scheduled_at: string;
  status: string;
  patients: { name: string };
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  // using any here because typescript is being annoying about the type
  const [campaignData, setCampaignData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // const dummyData = [{ id: 1, type: "reminder" }]; // test data, don't use


  useEffect(() => {
    async function load() {
      // console.log("fetching campaigns now...");
      const { data } = await myBackend
        .from("outbound_campaigns")
        .select("*, patients(name)")
        .order("scheduled_at", { ascending: true });

      console.log("got data from db!!!", data); // remember to take this out

      setCampaignData((data as any) || []);
      // we are done loading
      setLoading(false);
    }
    load();
  }, []);

  const typeIcons: Record<string, any> = {
    reminder: Bell,
    follow_up: Stethoscope,
    vaccination: Syringe,
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    completed: "bg-success/20 text-success",
    failed: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Outbound Campaigns</h1>
          <p className="text-xs text-muted-foreground">Reminders, follow-ups & vaccination alerts</p>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto">
        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : campaignData.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No campaigns scheduled</p>
            <p className="text-xs text-muted-foreground mt-1">
              Campaigns can be scheduled for appointment reminders and follow-ups
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaignData.map((campaign, i) => {
              const Icon = typeIcons[campaign.campaign_type] || Bell;
              return (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-foreground capitalize">
                          {campaign.campaign_type.replace("_", " ")}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{campaign.message}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{campaign.patients?.name}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(campaign.scheduled_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[campaign.status] || ""}`}>
                      {campaign.status}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

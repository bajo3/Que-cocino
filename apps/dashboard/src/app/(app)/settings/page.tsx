import { safe, db } from '../../../lib/data';
import { SettingsToggles } from '../../../components/SettingsToggles';
import { AssistantSettings } from '../../../components/AssistantSettings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const listen = await safe(() => db.isListenPaused(), false);
  const send = await safe(() => db.isSendPaused(), false);
  const summaryEnabled = await safe(() => db.getSetting<boolean>('daily_summary_enabled'), true);
  const summaryHour = await safe(() => db.getSetting<number>('daily_summary_hour'), 8);
  const draftsEnabled = await safe(() => db.getSetting<boolean>('draft_replies_enabled'), true);
  const style = await safe(() => db.getStyleProfile(), null as any);

  return (
    <div>
      <h2>Configuración</h2>
      <p className="muted">
        Controlá la escucha y los envíos. Estos interruptores se respetan en el listener en tiempo real
        (reglas de seguridad #5 y pausa de escucha).
      </p>
      <SettingsToggles listenPaused={listen.data} sendPaused={send.data} />
      <div style={{ marginTop: 18 }}>
        <AssistantSettings
          dailySummaryEnabled={summaryEnabled.data !== false}
          dailySummaryHour={Number(summaryHour.data ?? 8)}
          draftRepliesEnabled={draftsEnabled.data !== false}
        />
      </div>
      <div className="card section">
        <h3>Tu estilo aprendido</h3>
        <p>{style.data?.profile || 'Todavía faltan mensajes propios para crear el perfil.'}</p>
        <span className="muted">{style.data ? `${style.data.sample_count} mensajes analizados` : ''}</span>
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <h3>Notas</h3>
        <ul className="muted">
          <li>El envío también depende de <code>ENABLE_AUTO_SEND</code> en el entorno.</li>
          <li>Los envíos a grupos sólo se permiten con el comando <code>/mandar-grupo</code>.</li>
          <li>Ante ambigüedad de contacto, el sistema no envía y pide aclaración.</li>
        </ul>
      </div>
    </div>
  );
}

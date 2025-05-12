import { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { initializeFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import EmojiPicker from "emoji-picker-react";

const firebaseConfig = {
  apiKey: "AIzaSyD2Px5FWbA96KhL09YQcQDG-R758W5KnDI",
  authDomain: "clinicahall-142d0.firebaseapp.com",
  databaseURL: "https://clinicahall-142d0-default-rtdb.firebaseio.com",
  projectId: "clinicahall-142d0",
  storageBucket: "clinicahall-142d0.appspot.com",
  messagingSenderId: "588094242731",
  appId: "1:588094242731:web:76cf7e298e9fbb28e1dcee",
  measurementId: "G-9XG3DHY2MK"
};

const app = initializeApp(firebaseConfig);

// ✅ FORZAMOS que use chatdb (y no la anterior chatclinica)
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

const auth = getAuth(app);


export default function ChatClinica() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ nombre: "", rol: "" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [canal, setCanal] = useState("General");
  const [unread, setUnread] = useState({});
  const [usuariosConectados, setUsuariosConectados] = useState([]);
  const [popupNotification, setPopupNotification] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const chatEndRef = useRef(null);
  const audioRef = useRef(null);

  const canalesDisponibles = ["General", "Emergencias", ...(userData.rol === "medico" ? ["Doctores"] : [])];

  const login = async () => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      setUser(res.user);
      const idUsuario = email.split("@")[0];
      const userDocRef = doc(db, "usuarios", idUsuario);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setUserData(userDocSnap.data());
      } else {
        setUserData({ nombre: email, rol: "" });
      }
      await setDoc(doc(db, "usuariosConectados", idUsuario), {
        nombre: idUsuario,
        online: true,
        canal: "General",
      }, { merge: true });
    } catch (err) {
      alert("Error en login: " + err.message);
    }
  };

  const logout = async () => {
    const idUsuario = email.split("@")[0];
    await setDoc(doc(db, "usuariosConectados", idUsuario), { online: false }, { merge: true });
    await signOut(auth);
    setUser(null);
    setUserData({ nombre: "", rol: "" });
  };

  const formatHour = (date) => {
    const d = date.toDate ? date.toDate() : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (!user) return; // ✅ Solo conecta después del login
    const q = query(collection(db, "messages"), orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push(doc.data());
      });
      setMessages(msgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]); // ✅ Corre solo cuando `user` cambia

  useEffect(() => {
    if (!user) return; // ✅ Solo conecta después del login
    const q = query(collection(db, "usuariosConectados"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usuarios = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().online) {
          usuarios.push(doc.data());
        }
      });
      setUsuariosConectados(usuarios);
    });
    return () => unsubscribe();
  }, [user]); // ✅ Corre solo cuando `user` cambia

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (user) {
      const idUsuario = email.split("@")[0];
      updateDoc(doc(db, "usuariosConectados", idUsuario), { canal });
    }
  }, [canal, user]);

  const handleSend = async (text) => {
    if (text.trim() !== '') {
      try {
        await addDoc(collection(db, "messages"), {
          text,
          user: userData.nombre || email,
          canal,
          createdAt: new Date()
        });
        console.log("✅ Mensaje guardado correctamente");
      } catch (error) {
        console.error("❌ Error al guardar mensaje:", error);
        alert("Error al enviar el mensaje: " + error.message);
      }
    }
  };

  const getLastMessageForChannel = (canalName) => {
    const canalMessages = messages.filter(m => m.canal === canalName);
    return canalMessages.length ? canalMessages[canalMessages.length - 1].text : "Sin mensajes.";
  };

  if (!user) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#f0f2f5" }}>
        <div style={{ backgroundColor: "#ffffff", padding: 30, borderRadius: 10, boxShadow: "0 0 10px rgba(0,0,0,0.1)", width: "90%", maxWidth: "400px" }}>
          <h2>Login</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
          <button onClick={login} style={{ width: "100%" }}>Entrar</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "24px", color: "#25d366", backgroundColor: "#f0f2f5" }}>
        Cargando mensajes...
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", backgroundColor: "#f0f2f5" }}>
      
      {/* Panel izquierdo */}
      <div style={{ width: "250px", backgroundColor: "#ffffff", borderRight: "1px solid #ccc", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "10px", fontWeight: "bold", borderBottom: "1px solid #ccc", color: "#333" }}>
          Canales
        </div>
        {canalesDisponibles.map((c) => (
          <div key={c} onClick={() => { setCanal(c); setUnread(prev => ({ ...prev, [c]: false })); }}
            style={{ padding: "10px", backgroundColor: canal === c ? "#dcf8c6" : "#ffffff", color: "#333", cursor: "pointer", borderBottom: "1px solid #eee", fontWeight: canal === c || unread[c] ? "bold" : "normal", borderLeft: canal === c ? "4px solid #25d366" : "4px solid transparent", transition: "background-color 0.3s ease" }}>
            <div>{c}</div>
            <div style={{ fontSize: "12px", color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {getLastMessageForChannel(c)}
            </div>
          </div>
        ))}

        {/* Usuarios conectados */}
        <div style={{ padding: "10px", fontWeight: "bold", borderTop: "1px solid #ccc", color: "#333", marginTop: "10px" }}>
          Usuarios conectados
        </div>
        {usuariosConectados.map((u, idx) => (
          <div key={idx} style={{ padding: "5px 10px", display: "flex", alignItems: "center", fontSize: "14px", color: "#25d366" }}>
            <span style={{ marginRight: "8px" }}>✅</span> {u.nombre}
          </div>
        ))}
      </div>

      {/* Panel de chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
        <div style={{ padding: "10px", borderBottom: "1px solid #ccc", color: "#333" }}>
          <b>Canal:</b> {canal}
          <button onClick={logout} style={{ float: "right" }}>Cerrar sesión</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 10, backgroundColor: "#e5ddd5" }}>
          {messages.filter(msg => msg.canal === canal).map((msg, idx) => {
            const isMine = msg.user === (userData.nombre || email);
            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", marginBottom: "2px", color: "#555" }}>{msg.user}</div>
                <div style={{ maxWidth: "70%", padding: "10px", borderRadius: "10px", backgroundColor: isMine ? "#dcf8c6" : "#ffffff", color: "#333", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
                  {msg.text}
                  <div style={{ fontSize: "10px", textAlign: "right", marginTop: "5px", color: "#999" }}>{formatHour(msg.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ display: "flex", padding: 10, backgroundColor: "#ffffff", borderTop: "1px solid #ccc", position: "relative" }}>
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", marginRight: "5px" }}>
            😀
          </button>

          {showEmojiPicker && (
            <div style={{ position: "absolute", bottom: "60px", left: "10px", zIndex: 1000 }}>
              <EmojiPicker onEmojiClick={(emojiData) => setMessage(prev => prev + emojiData.emoji)} />
            </div>
          )}

          <input
            placeholder="Escribe un mensaje..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && e.target.value.trim() !== '') {
                e.preventDefault();
                const text = e.target.value;
                setMessage('');
                await handleSend(text);
              }
            }}
            style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #ccc", marginRight: "10px", outline: "none" }}
          />
          <button onClick={async () => {
            if (message.trim() !== '') {
              const text = message;
              setMessage('');
              await handleSend(text);
            }
          }} style={{ padding: "10px 20px", borderRadius: "20px", backgroundColor: "#25d366", color: "white", border: "none", cursor: "pointer" }}>
            Enviar
          </button>
        </div>

        <audio ref={audioRef} src="/notification.mp3" preload="auto" />
      </div>
    </div>
  );
}

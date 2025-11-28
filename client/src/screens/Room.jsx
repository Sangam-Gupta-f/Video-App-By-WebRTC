import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();

  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isCallStarted, setIsCallStarted] = useState(false);

  // ------------------------------------------------------------
  // GET MEDIA ONCE → WHEN PAGE LOADS
  // ------------------------------------------------------------
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setMyStream(stream);

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          peer.peer.addTrack(track, stream);
        });
      } catch (error) {
        console.error("Camera Start Error:", error);
      }
    };

    startCamera();
  }, []);

  // ------------------------------------------------------------
  // When other user joins room
  // ------------------------------------------------------------
  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  // ------------------------------------------------------------
  // Caller initiates call
  // ------------------------------------------------------------
  const handleCallUser = useCallback(async () => {
    if (!myStream) {
      alert("Camera not ready yet");
      return;
    }

    setIsCallStarted(true);

    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
  }, [remoteSocketId, socket, myStream]);

  // ------------------------------------------------------------
  // Receiving incoming call
  // ------------------------------------------------------------
  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);

      if (!myStream) {
        console.warn("Stream not ready on incoming call");
        return;
      }

      setIsCallStarted(true);

      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket, myStream]
  );

  // ------------------------------------------------------------
  // Callee accepted call
  // ------------------------------------------------------------
  const handleCallAccepted = useCallback(({ from, ans }) => {
    peer.setLocalDescription(ans);
  }, []);

  // ------------------------------------------------------------
  // Negotiation Needed
  // ------------------------------------------------------------
  const handleNegoNeeded = useCallback(async () => {
    if (!isCallStarted) return;

    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket, isCallStarted]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);

    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  // ------------------------------------------------------------
  // Handling negotiation
  // ------------------------------------------------------------
  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  // ------------------------------------------------------------
  // Getting remote stream
  // ------------------------------------------------------------
  useEffect(() => {
    peer.peer.addEventListener("track", (ev) => {
      console.log("GOT REMOTE TRACKS");
      setRemoteStream(ev.streams[0]);
    });
  }, []);

  // ------------------------------------------------------------
  // Socket listeners
  // ------------------------------------------------------------
  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("ice-candidate", ({ candidate }) => {
      console.log("GOT REMOTE ICE:", candidate);
      peer.peer.addIceCandidate(candidate);
    });

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Connected" : "Waiting for someone..."}</h4>

      {remoteSocketId && <button onClick={handleCallUser}>CALL</button>}

      {myStream && (
        <>
          <h2>My Stream</h2>
          <ReactPlayer
            playing
            muted
            height="150px"
            width="250px"
            url={myStream}
          />
        </>
      )}

      {remoteStream && (
        <>
          <h2>Remote Stream</h2>
          <ReactPlayer
            playing
            height="150px"
            width="250px"
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default RoomPage;
